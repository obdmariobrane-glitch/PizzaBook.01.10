import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@react-native-vector-icons/ionicons';

import {
  COST_CATEGORIES,
  DEFAULT_INGREDIENTS,
  calculateRecipeCosts,
  calculateEnergyCosts,
  compatibleUnits,
  getNormalizedUnitCost,
  normalizeUnitQuantity,
  parseDecimalInput,
  parseProRecipeImport,
  unitDimension,
  validateCostCalculatorState,
  type CostCalculatorState,
  type CostCategoryId,
  type CostIngredient,
  type CostRecipeItem,
  type CostUnit,
  type DefaultIngredientId,
} from '../src/costCalculator';
import {
  getCountriesForEnergyPicker,
  getEnergyCountryLabel,
  getEnergyCurrency,
  getReferenceEnergyPrice,
  type EnergyType,
} from '../src/energyCost';
import { loadCostCalculatorState, saveCostCalculatorState } from '../src/costCalculatorStorage';
import { useT } from '../src/i18n/LanguageProvider';
import { costCalculatorCopy } from '../src/i18n/costCalculator';
import { getCachedExperienceLevel, subscribeExperienceLevel } from '../src/experienceLevel';
import { COLORS, RADIUS, SPACING } from '../src/theme';

const UNIT_OPTIONS: CostUnit[] = ['g', 'kg', 'ml', 'L', 'pieces'];

function isDefaultIngredientId(id: string): id is DefaultIngredientId {
  return DEFAULT_INGREDIENTS.some((ingredient) => ingredient.id === id);
}

function getBaseUnit(unit: CostUnit): CostUnit {
  if (unitDimension(unit) === 'weight') return 'g';
  if (unitDimension(unit) === 'volume') return 'ml';
  return 'pieces';
}

function displayAmountInUnit(amount: number, unit: CostUnit): number {
  return unit === 'kg' || unit === 'L' ? amount / 1000 : amount;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCurrency(amount: number, locale: string, precise = false): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: precise ? 4 : 2,
    maximumFractionDigits: precise ? 6 : 2,
  }).format(amount);
}

function formatLocalCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function CostCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useT();
  const copy = costCalculatorCopy[lang];
  const experienceLevel = useSyncExternalStore(
    subscribeExperienceLevel,
    getCachedExperienceLevel,
    getCachedExperienceLevel,
  );

  const [state, setState] = useState<CostCalculatorState | null>(null);
  const stateRef = useRef<CostCalculatorState | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CostCategoryId | 'all'>('all');
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<CostIngredient | null>(null);
  const [ingredientName, setIngredientName] = useState('');
  const [purchasePriceInput, setPurchasePriceInput] = useState('');
  const [packageQuantityInput, setPackageQuantityInput] = useState('');
  const [packageUnit, setPackageUnit] = useState<CostUnit>('kg');
  const [ingredientFormError, setIngredientFormError] = useState('');
  const [recipeDrafts, setRecipeDrafts] = useState<Record<string, string>>({});
  const [recipeInputError, setRecipeInputError] = useState('');
  const [batchInput, setBatchInput] = useState('1');
  const [batchInputError, setBatchInputError] = useState('');
  const [pendingImport, setPendingImport] = useState<CostRecipeItem[] | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [screenError, setScreenError] = useState('');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [energyPriceDraft, setEnergyPriceDraft] = useState('');
  const [energyConsumptionDraft, setEnergyConsumptionDraft] = useState('');
  const [energyFormError, setEnergyFormError] = useState('');

  useEffect(() => {
    let active = true;
    void loadCostCalculatorState().then((loaded) => {
      if (!active) return;
      stateRef.current = loaded;
      setState(loaded);
      setBatchInput(String(loaded.batchSize));
      setEnergyPriceDraft(loaded.energy.unitPrice === null ? '' : String(loaded.energy.unitPrice));
      setEnergyConsumptionDraft(loaded.energy.ovenConsumption === null ? '' : String(loaded.energy.ovenConsumption));
    }).catch((error: unknown) => {
      console.error('Unable to initialize the pizza cost calculator.', error);
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  const updateState = useCallback((update: (current: CostCalculatorState) => CostCalculatorState) => {
    const current = stateRef.current;
    if (!current) return;
    const next = validateCostCalculatorState(update(current));
    stateRef.current = next;
    setState(next);
    setSaveError(false);
    setIsSaving(true);
    const write = saveQueue.current.then(() => saveCostCalculatorState(next));
    saveQueue.current = write.then(
      () => {
        setIsSaving(false);
        setSaveError(false);
      },
      (error: unknown) => {
        console.error('Unable to persist pizza cost calculator changes.', error);
        setIsSaving(false);
        setSaveError(true);
      },
    );
  }, []);

  const addToRecipe = useCallback((ingredient: CostIngredient) => {
    updateState((current) => {
      if (current.recipeItems.some((item) => item.ingredientId === ingredient.id)) return current;
      const unit = getBaseUnit(ingredient.packageUnit);
      return {
        ...current,
        recipeItems: [
          ...current.recipeItems,
          { id: makeId('pizza-ingredient'), ingredientId: ingredient.id, quantity: 0, unit },
        ],
      };
    });
    setRecipeInputError('');
  }, [updateState]);

  const openIngredientEditor = (ingredient?: CostIngredient) => {
    setEditingIngredient(ingredient ?? null);
    setIngredientName(ingredient?.name ?? '');
    setPurchasePriceInput(ingredient?.purchasePrice === null || ingredient?.purchasePrice === undefined
      ? ''
      : String(ingredient.purchasePrice));
    setPackageQuantityInput(ingredient?.packageQuantity === null || ingredient?.packageQuantity === undefined
      ? ''
      : String(ingredient.packageQuantity));
    setPackageUnit(ingredient?.packageUnit ?? 'kg');
    setIngredientFormError('');
    setIngredientModalOpen(true);
  };

  const commitIngredient = () => {
    const customName = ingredientName.trim();
    if ((!editingIngredient || editingIngredient.isCustom) && !customName) {
      setIngredientFormError(copy.invalidName);
      return;
    }
    const current = stateRef.current;
    if (editingIngredient && current?.recipeItems.some((item) =>
      item.ingredientId === editingIngredient.id
      && unitDimension(item.unit) !== unitDimension(packageUnit))) {
      setIngredientFormError(copy.packageUnitMismatch);
      return;
    }
    const priceText = purchasePriceInput.trim();
    const packageText = packageQuantityInput.trim();
    if ((priceText === '') !== (packageText === '')) {
      setIngredientFormError(copy.invalidPackage);
      return;
    }
    const price = priceText === '' ? null : parseDecimalInput(priceText);
    const quantity = packageText === '' ? null : parseDecimalInput(packageText);
    if (priceText !== '' && (price === null || price < 0)) {
      setIngredientFormError(copy.invalidNumber);
      return;
    }
    if (packageText !== '' && (quantity === null || quantity <= 0)) {
      setIngredientFormError(copy.emptyPackage);
      return;
    }
    const ingredient: CostIngredient = editingIngredient
      ? {
        ...editingIngredient,
        ...(editingIngredient.isCustom ? { name: customName } : {}),
        purchasePrice: price,
        packageQuantity: quantity,
        packageUnit,
      }
      : {
        id: makeId('custom'),
        categoryId: 'custom',
        isCustom: true,
        name: customName,
        purchasePrice: price,
        packageQuantity: quantity,
        packageUnit,
      };
    updateState((current) => ({
      ...current,
      ingredients: editingIngredient
        ? current.ingredients.map((item) => item.id === editingIngredient.id ? ingredient : item)
        : [...current.ingredients, ingredient],
    }));
    setIngredientModalOpen(false);
  };

  const deleteCustomIngredient = (ingredient: CostIngredient) => {
    if (!ingredient.isCustom) return;
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.deleteConfirmAction,
        style: 'destructive',
        onPress: () => {
          updateState((current) => ({
            ...current,
            ingredients: current.ingredients.filter((item) => item.id !== ingredient.id),
            recipeItems: current.recipeItems.filter((item) => item.ingredientId !== ingredient.id),
          }));
          setIngredientModalOpen(false);
        },
      },
    ]);
  };

  const updateRecipeQuantity = (item: CostRecipeItem, raw: string) => {
    const quantity = parseDecimalInput(raw);
    if (quantity === null || quantity <= 0) {
      setRecipeInputError(copy.invalidQuantity);
      setRecipeDrafts((drafts) => ({ ...drafts, [item.id]: String(item.quantity || '') }));
      return;
    }
    setRecipeInputError('');
    setRecipeDrafts((drafts) => ({ ...drafts, [item.id]: String(quantity) }));
    updateState((current) => ({
      ...current,
      recipeItems: current.recipeItems.map((candidate) =>
        candidate.id === item.id ? { ...candidate, quantity } : candidate),
    }));
  };

  const updateRecipeUnit = (item: CostRecipeItem, nextUnit: CostUnit) => {
    if (unitDimension(item.unit) !== unitDimension(nextUnit)) return;
    const baseQuantity = normalizeUnitQuantity(item.quantity, item.unit);
    const quantity = displayAmountInUnit(baseQuantity, nextUnit);
    setRecipeDrafts((drafts) => ({ ...drafts, [item.id]: String(quantity) }));
    updateState((current) => ({
      ...current,
      recipeItems: current.recipeItems.map((candidate) =>
        candidate.id === item.id ? { ...candidate, quantity, unit: nextUnit } : candidate),
    }));
  };

  const updateBatchSize = (raw: string) => {
    setBatchInput(raw);
    const parsed = parseDecimalInput(raw);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 9999) {
      setBatchInputError(copy.invalidQuantity);
      return;
    }
    setBatchInputError('');
    updateState((current) => ({ ...current, batchSize: parsed }));
  };

  const loadProImport = async () => {
    setImportMessage('');
    setScreenError('');
    if (experienceLevel !== 'pro') {
      setImportMessage(copy.proImportOnly);
      return;
    }
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem('lastRecipe');
    } catch (error) {
      console.error('Unable to read the saved recipe for Pro dough import.', error);
      setScreenError(copy.importError);
      return;
    }
    if (raw === null) {
      setImportMessage(copy.noSavedRecipe);
      return;
    }
    let recipe: unknown;
    try {
      recipe = JSON.parse(raw);
    } catch (error) {
      console.error('The saved recipe for Pro dough import is not valid JSON.', error);
      setScreenError(copy.importError);
      return;
    }
    const imported = parseProRecipeImport(recipe);
    if (!imported) {
      setImportMessage(copy.invalidProRecipe);
      return;
    }
    setPendingImport(imported);
  };

  const applyProImport = () => {
    if (!pendingImport) return;
    updateState((current) => ({ ...current, recipeItems: pendingImport }));
    setRecipeDrafts(Object.fromEntries(pendingImport.map((item) => [item.id, String(item.quantity)])));
    setPendingImport(null);
    setImportMessage(copy.importSuccess);
  };

  const names = useMemo(() => new Map(
    state?.ingredients.map((ingredient) => [
      ingredient.id,
      ingredient.isCustom
        ? ingredient.name ?? ingredient.id
        : isDefaultIngredientId(ingredient.id)
          ? copy.ingredientNames[ingredient.id]
          : ingredient.id,
    ]) ?? [],
  ), [state?.ingredients, copy.ingredientNames]);

  const filteredIngredients = useMemo(() => {
    if (!state) return [];
    const query = search.trim().toLocaleLowerCase(lang);
    return state.ingredients.filter((ingredient) => {
      const categoryMatches = activeCategory === 'all' || ingredient.categoryId === activeCategory;
      const nameMatches = (names.get(ingredient.id) ?? '').toLocaleLowerCase(lang).includes(query);
      return categoryMatches && nameMatches;
    });
  }, [activeCategory, lang, names, search, state]);

  const costs = state ? calculateRecipeCosts(state) : null;
  const locale = { hr: 'hr-HR', en: 'en-IE', de: 'de-DE', sl: 'sl-SI' }[lang];
  const countries = useMemo(
    () => getCountriesForEnergyPicker(locale),
    [locale],
  );
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase(locale);
    return countries.filter((country) => (
      `${getEnergyCountryLabel(country.code, locale)} ${country.code}`
        .toLocaleLowerCase(locale)
        .includes(query)
    ));
  }, [countries, countrySearch, locale]);
  const energyCosts = state ? calculateEnergyCosts(state.energy, state.batchSize) : null;
  const energyCurrency = state ? getEnergyCurrency(state.energy.countryCode) : null;
  const energyPriceUnit = state?.energy.energyType === 'lpg' ? copy.lpgUnitPrice : copy.energyUnitPrice;
  const energyConsumptionUnit = state?.energy.energyType === 'lpg'
    ? copy.lpgConsumptionUnit
    : copy.energyConsumptionUnit;
  const referencePrice = state
    ? getReferenceEnergyPrice(state.energy.countryCode, state.energy.energyType)
    : null;
  const getUnitLabel = (unit: CostUnit) => copy.units[unit];
  const ingredientById = new Map(state?.ingredients.map((ingredient) => [ingredient.id, ingredient]) ?? []);

  const selectCountry = (countryCode: string, keepPrice: boolean) => {
    updateState((current) => ({
      ...current,
      energy: {
        ...current.energy,
        countryCode,
        unitPrice: keepPrice ? current.energy.unitPrice : null,
      },
    }));
    if (!keepPrice) setEnergyPriceDraft('');
    setEnergyFormError('');
    setCountryPickerOpen(false);
    setCountrySearch('');
  };

  const requestCountryChange = (countryCode: string) => {
    if (!state || countryCode === state.energy.countryCode) {
      setCountryPickerOpen(false);
      return;
    }
    if (state.energy.unitPrice === null) {
      selectCountry(countryCode, false);
      return;
    }
    setCountryPickerOpen(false);
    Alert.alert(copy.priceCountryChangeTitle, copy.priceCountryChangeBody, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.keepPrice, onPress: () => selectCountry(countryCode, true) },
      { text: copy.clearPrice, style: 'destructive', onPress: () => selectCountry(countryCode, false) },
    ]);
  };

  const requestEnergyTypeChange = (energyType: EnergyType) => {
    if (!state || energyType === state.energy.energyType) return;
    const applyType = (keepPrice: boolean) => {
      updateState((current) => ({
        ...current,
        energy: {
          ...current.energy,
          energyType,
          unitPrice: keepPrice ? current.energy.unitPrice : null,
          ovenConsumption: null,
        },
      }));
      setEnergyPriceDraft(keepPrice && state.energy.unitPrice !== null ? String(state.energy.unitPrice) : '');
      setEnergyConsumptionDraft('');
      setEnergyFormError('');
    };
    if (state.energy.unitPrice === null) {
      applyType(false);
      return;
    }
    Alert.alert(copy.priceUnitChangeTitle, copy.priceUnitChangeBody, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.keepPrice, onPress: () => applyType(true) },
      { text: copy.clearPrice, style: 'destructive', onPress: () => applyType(false) },
    ]);
  };

  if (loadError) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + SPACING.xl }]}>
        <Text style={styles.errorText}>{copy.loadError}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            setLoadError(false);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          <Text style={styles.primaryButtonText}>{copy.tryAgain}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>{copy.back}</Text>
        </Pressable>
      </View>
    );
  }
  if (!state || !costs) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + SPACING.xl }]}>
        <ActivityIndicator color={COLORS.brand} />
        <Text style={styles.bodyText}>{copy.loading}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          testID="cost-calculator-back"
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.sectionTitle}>{copy.recipe}</Text>
            <View style={styles.saveStatus}>
              {isSaving ? <ActivityIndicator size="small" color={COLORS.brand} /> : null}
              <Text style={styles.saveStatusText}>
                {saveError ? copy.saveError : isSaving ? '…' : copy.saved}
              </Text>
            </View>
          </View>
          <View style={styles.batchRow}>
            <Text style={styles.fieldLabel}>{copy.batchSize}</Text>
            <TextInput
              testID="cost-batch-size"
              value={batchInput}
              onChangeText={setBatchInput}
              onEndEditing={() => updateBatchSize(batchInput)}
              keyboardType="number-pad"
              style={styles.batchInput}
              accessibilityLabel={copy.batchSize}
            />
          </View>
          {batchInputError ? <Text style={styles.errorText}>{batchInputError}</Text> : null}
          {state.recipeItems.length === 0 ? (
            <Text style={styles.emptyText}>{copy.noRecipeItems}</Text>
          ) : (
            <View style={styles.recipeList}>
              {state.recipeItems.map((item) => {
                const ingredient = ingredientById.get(item.ingredientId);
                const cost = costs.itemCosts.find((line) => line.itemId === item.id)?.cost ?? null;
                const unitOptions = compatibleUnits(item.unit);
                return (
                  <View key={item.id} testID={`cost-recipe-item-${item.ingredientId}`} style={styles.recipeItem}>
                    <View style={styles.recipeItemHeading}>
                      <Text style={styles.ingredientTitle}>{names.get(item.ingredientId) ?? item.ingredientId}</Text>
                      <Pressable
                        testID={`cost-remove-${item.ingredientId}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${copy.deleteIngredient} ${names.get(item.ingredientId) ?? item.ingredientId}`}
                        onPress={() => updateState((current) => ({
                          ...current,
                          recipeItems: current.recipeItems.filter((candidate) => candidate.id !== item.id),
                        }))}
                        hitSlop={8}
                      >
                        <Icon name="close-circle-outline" size={21} color={COLORS.muted} />
                      </Pressable>
                    </View>
                    <View style={styles.recipeInputRow}>
                      <TextInput
                        testID={`cost-quantity-${item.ingredientId}`}
                        value={recipeDrafts[item.id] ?? String(item.quantity || '')}
                        onChangeText={(value) => setRecipeDrafts((drafts) => ({ ...drafts, [item.id]: value }))}
                        onEndEditing={() => updateRecipeQuantity(item, recipeDrafts[item.id] ?? String(item.quantity))}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        style={[styles.textInput, styles.quantityInput]}
                        accessibilityLabel={copy.perPizzaQuantity}
                      />
                      <View style={styles.unitPickerCompact}>
                        {unitOptions.map((unit) => (
                          <Pressable
                            key={unit}
                            testID={`cost-unit-${item.ingredientId}-${unit}`}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: item.unit === unit }}
                            onPress={() => updateRecipeUnit(item, unit)}
                            style={[styles.unitChip, item.unit === unit && styles.unitChipSelected]}
                          >
                            <Text style={[styles.unitChipText, item.unit === unit && styles.unitChipTextSelected]}>
                              {getUnitLabel(unit)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.itemCost}>
                        {cost === null ? '—' : formatCurrency(cost, locale)}
                      </Text>
                    </View>
                    <Text style={styles.costHint}>
                      {ingredient && getNormalizedUnitCost(ingredient) !== null
                        ? `${formatCurrency(getNormalizedUnitCost(ingredient) ?? 0, locale, true)} / ${getUnitLabel(getBaseUnit(ingredient.packageUnit))}`
                        : copy.notPriced}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          {recipeInputError ? <Text style={styles.errorText}>{recipeInputError}</Text> : null}
          {state.recipeItems.length > 0 && !costs.isComplete
            ? <Text style={styles.warningText}>{copy.incompleteCost}</Text>
            : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{copy.perPizzaCost}</Text>
            <Text testID="cost-per-pizza" style={styles.totalValue}>
              {costs.perPizzaCost === null ? '—' : formatCurrency(costs.perPizzaCost, locale)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{copy.batchCost}</Text>
            <Text testID="cost-batch-total" style={styles.totalValue}>
              {costs.batchCost === null ? '—' : formatCurrency(costs.batchCost, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.energyCard}>
          <Text style={styles.sectionTitle}>{copy.energyTitle}</Text>
          <Text style={styles.bodyText}>{copy.energyCurrencyNote}</Text>
          <Text style={styles.fieldLabel}>{copy.country}</Text>
          <Pressable
            testID="energy-country-picker"
            accessibilityRole="button"
            onPress={() => setCountryPickerOpen(true)}
            style={styles.countryButton}
          >
            <Text style={styles.countryButtonText}>
              {getEnergyCountryLabel(state.energy.countryCode, locale)}
              {energyCurrency ? ` · ${energyCurrency}` : ''}
            </Text>
            <Icon name="chevron-down" size={18} color={COLORS.muted} />
          </Pressable>

          <Text style={styles.fieldLabel}>{copy.energyType}</Text>
          <View style={styles.energyTypeList}>
            {([
              ['electricity', copy.electricity],
              ['naturalGas', copy.naturalGas],
              ['lpg', copy.lpg],
            ] as const).map(([type, label]) => (
              <Pressable
                key={type}
                testID={`energy-type-${type}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: state.energy.energyType === type }}
                onPress={() => requestEnergyTypeChange(type)}
                style={[styles.energyTypeButton, state.energy.energyType === type && styles.energyTypeButtonSelected]}
              >
                <Text style={[styles.energyTypeText, state.energy.energyType === type && styles.energyTypeTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            {copy.energyPrice}{energyCurrency ? ` (${energyCurrency} ${energyPriceUnit})` : ''}
          </Text>
          <TextInput
            testID="energy-unit-price"
            value={energyPriceDraft}
            onChangeText={setEnergyPriceDraft}
            onEndEditing={() => {
              if (energyPriceDraft.trim() === '') {
                updateState((current) => ({ ...current, energy: { ...current.energy, unitPrice: null } }));
                setEnergyFormError('');
                return;
              }
              const price = parseDecimalInput(energyPriceDraft);
              if (price === null || price < 0 || !energyCurrency) {
                setEnergyFormError(!energyCurrency ? copy.countryCurrencyUnavailable : copy.energyInvalidPrice);
                return;
              }
              updateState((current) => ({ ...current, energy: { ...current.energy, unitPrice: price } }));
              setEnergyFormError('');
            }}
            editable={energyCurrency !== null}
            keyboardType="decimal-pad"
            placeholder="0,00"
            style={[styles.textInput, energyCurrency === null && styles.readOnlyInput]}
            accessibilityLabel={`${copy.energyPrice}${energyCurrency ? ` (${energyCurrency} ${energyPriceUnit})` : ''}`}
          />
          <Text style={styles.bodyText}>
            {referencePrice
              ? `${copy.referenceAvailable}: ${formatLocalCurrency(referencePrice.amount, referencePrice.currency, locale)} ${copy.orientedPrice} · ${referencePrice.source} · ${referencePrice.date}`
              : copy.referenceUnavailable}
          </Text>
          {referencePrice && state.energy.unitPrice === null ? (
            <Pressable
              testID="energy-use-reference-price"
              style={styles.secondaryButton}
              onPress={() => {
                setEnergyPriceDraft(String(referencePrice.amount));
                updateState((current) => ({
                  ...current,
                  energy: { ...current.energy, unitPrice: referencePrice.amount },
                }));
              }}
            >
              <Text style={styles.secondaryButtonText}>{copy.referenceAvailable}</Text>
            </Pressable>
          ) : null}

          <Text style={styles.fieldLabel}>{copy.ovenName}</Text>
          <TextInput
            testID="energy-oven-name"
            value={state.energy.ovenName}
            onChangeText={(ovenName) => updateState((current) => ({
              ...current,
              energy: { ...current.energy, ovenName: ovenName.slice(0, 100) },
            }))}
            placeholder={copy.ovenName}
            style={styles.textInput}
            accessibilityLabel={copy.ovenName}
          />
          <Text style={styles.fieldLabel}>
            {copy.ovenConsumption} ({energyConsumptionUnit})
          </Text>
          <TextInput
            testID="energy-oven-consumption"
            value={energyConsumptionDraft}
            onChangeText={setEnergyConsumptionDraft}
            onEndEditing={() => {
              if (energyConsumptionDraft.trim() === '') {
                updateState((current) => ({ ...current, energy: { ...current.energy, ovenConsumption: null } }));
                setEnergyFormError('');
                return;
              }
              const consumption = parseDecimalInput(energyConsumptionDraft);
              if (consumption === null || consumption <= 0) {
                setEnergyFormError(copy.energyInvalidConsumption);
                return;
              }
              updateState((current) => ({
                ...current,
                energy: { ...current.energy, ovenConsumption: consumption },
              }));
              setEnergyFormError('');
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            style={styles.textInput}
            accessibilityLabel={`${copy.ovenConsumption} (${energyConsumptionUnit})`}
          />
          {energyFormError ? <Text style={styles.errorText}>{energyFormError}</Text> : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{copy.energyPerPizza}</Text>
            <Text testID="energy-cost-per-pizza" style={styles.energyTotalValue}>
              {!energyCosts || energyCosts.perPizzaCost === null || !energyCurrency
                ? '—'
                : formatLocalCurrency(energyCosts.perPizzaCost, energyCurrency, locale)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{copy.energyPerBatch}</Text>
            <Text testID="energy-cost-per-batch" style={styles.energyTotalValue}>
              {!energyCosts || energyCosts.batchCost === null || !energyCurrency
                ? '—'
                : formatLocalCurrency(energyCosts.batchCost, energyCurrency, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.importCard}>
          <View style={styles.importCopy}>
            <Text style={styles.importTitle}>{copy.importProDough}</Text>
            <Text style={styles.bodyText}>{copy.proImportOnly}</Text>
          </View>
          <Pressable
            testID="cost-import-pro-dough"
            accessibilityRole="button"
            accessibilityState={{ disabled: experienceLevel !== 'pro' }}
            onPress={() => { void loadProImport(); }}
            disabled={experienceLevel !== 'pro'}
            style={[styles.secondaryButton, experienceLevel !== 'pro' && styles.disabledButton]}
          >
            <Icon name="download-outline" size={18} color={experienceLevel === 'pro' ? COLORS.brand : COLORS.muted} />
            <Text style={[styles.secondaryButtonText, experienceLevel !== 'pro' && styles.disabledButtonText]}>
              {copy.importProDough}
            </Text>
          </Pressable>
          {importMessage ? <Text style={styles.bodyText}>{importMessage}</Text> : null}
          {screenError ? <Text style={styles.errorText}>{screenError}</Text> : null}
        </View>

        <View style={styles.catalogCard}>
          <View style={styles.catalogHeading}>
            <View style={styles.catalogTitleWrap}>
              <Text style={styles.sectionTitle}>{copy.catalog}</Text>
              <Text style={styles.bodyText}>{copy.priceHint}</Text>
            </View>
            <Pressable
              testID="cost-add-custom"
              accessibilityRole="button"
              onPress={() => openIngredientEditor()}
              style={styles.addCustomButton}
            >
              <Icon name="add" size={19} color="#fff" />
              <Text style={styles.addCustomText}>{copy.addCustom}</Text>
            </Pressable>
          </View>

          <TextInput
            testID="cost-ingredient-search"
            value={search}
            onChangeText={setSearch}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={COLORS.muted}
            style={styles.textInput}
            accessibilityLabel={copy.searchPlaceholder}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <Pressable
              testID="cost-category-all"
              accessibilityRole="radio"
              accessibilityState={{ checked: activeCategory === 'all' }}
              onPress={() => setActiveCategory('all')}
              style={[styles.categoryChip, activeCategory === 'all' && styles.categoryChipSelected]}
            >
              <Text style={[styles.categoryChipText, activeCategory === 'all' && styles.categoryChipTextSelected]}>
                {copy.catalog}
              </Text>
            </Pressable>
            {COST_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                testID={`cost-category-${category}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: activeCategory === category }}
                onPress={() => setActiveCategory(category)}
                style={[styles.categoryChip, activeCategory === category && styles.categoryChipSelected]}
              >
                <Text style={[styles.categoryChipText, activeCategory === category && styles.categoryChipTextSelected]}>
                  {copy.categories[category]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredIngredients.length === 0 ? (
            <Text style={styles.emptyText}>{copy.noSearchResults}</Text>
          ) : (
            <View style={styles.catalogList}>
              {filteredIngredients.map((ingredient) => {
                const unitCost = getNormalizedUnitCost(ingredient);
                const isInRecipe = state.recipeItems.some((item) => item.ingredientId === ingredient.id);
                return (
                  <View key={ingredient.id} testID={`cost-catalog-${ingredient.id}`} style={styles.catalogItem}>
                    <View style={styles.catalogItemMain}>
                      <Text style={styles.ingredientTitle}>{names.get(ingredient.id) ?? ingredient.id}</Text>
                      <Text style={styles.costHint}>
                        {unitCost === null
                          ? copy.noPrices
                          : `${formatCurrency(unitCost, locale, true)} / ${getUnitLabel(getBaseUnit(ingredient.packageUnit))}`}
                      </Text>
                    </View>
                    <View style={styles.catalogActions}>
                      {ingredient.isCustom ? (
                        <Pressable
                          testID={`cost-edit-${ingredient.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${copy.editIngredient} ${ingredient.name}`}
                          onPress={() => openIngredientEditor(ingredient)}
                          hitSlop={8}
                        >
                          <Icon name="create-outline" size={21} color={COLORS.brand} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        testID={`cost-configure-${ingredient.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${copy.editIngredient} ${names.get(ingredient.id) ?? ingredient.id}`}
                        onPress={() => openIngredientEditor(ingredient)}
                        hitSlop={8}
                      >
                        <Icon name="pricetag-outline" size={21} color={COLORS.brand} />
                      </Pressable>
                      {ingredient.isCustom ? (
                        <Pressable
                          testID={`cost-delete-${ingredient.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${copy.deleteIngredient} ${ingredient.name}`}
                          onPress={() => deleteCustomIngredient(ingredient)}
                          hitSlop={8}
                        >
                          <Icon name="trash-outline" size={21} color={COLORS.error} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        testID={`cost-add-${ingredient.id}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isInRecipe }}
                        onPress={() => addToRecipe(ingredient)}
                        disabled={isInRecipe}
                        style={[styles.addButton, isInRecipe && styles.addedButton]}
                      >
                        <Text style={[styles.addButtonText, isInRecipe && styles.addedButtonText]}>
                          {isInRecipe ? copy.alreadyAdded : copy.addToRecipe}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={ingredientModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIngredientModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editingIngredient ? copy.editIngredient : copy.addIngredient}
              </Text>
              <Text style={styles.fieldLabel}>{copy.ingredientName}</Text>
              <TextInput
                testID="cost-edit-name"
                value={editingIngredient?.isCustom ? ingredientName : editingIngredient ? names.get(editingIngredient.id) ?? '' : ingredientName}
                onChangeText={setIngredientName}
                editable={!editingIngredient || editingIngredient.isCustom}
                placeholder={copy.ingredientName}
                style={[styles.textInput, editingIngredient && !editingIngredient.isCustom && styles.readOnlyInput]}
                accessibilityLabel={copy.ingredientName}
              />
              <Text style={styles.fieldLabel}>{copy.purchasePrice}</Text>
              <TextInput
                testID="cost-edit-price"
                value={purchasePriceInput}
                onChangeText={setPurchasePriceInput}
                keyboardType="decimal-pad"
                placeholder="0,00"
                style={styles.textInput}
                accessibilityLabel={copy.purchasePrice}
              />
              <Text style={styles.fieldLabel}>{copy.packageQuantity}</Text>
              <View style={styles.packageRow}>
                <TextInput
                  testID="cost-edit-package-quantity"
                  value={packageQuantityInput}
                  onChangeText={setPackageQuantityInput}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  style={[styles.textInput, styles.packageInput]}
                  accessibilityLabel={copy.packageQuantity}
                />
                <View style={styles.unitPicker}>
                  {UNIT_OPTIONS.map((unit) => (
                    <Pressable
                      key={unit}
                      testID={`cost-package-unit-${unit}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: packageUnit === unit }}
                      onPress={() => setPackageUnit(unit)}
                      style={[styles.unitChip, packageUnit === unit && styles.unitChipSelected]}
                    >
                      <Text style={[styles.unitChipText, packageUnit === unit && styles.unitChipTextSelected]}>
                        {getUnitLabel(unit)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {ingredientFormError ? <Text style={styles.errorText}>{ingredientFormError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setIngredientModalOpen(false)}>
                  <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
                </Pressable>
                <Pressable testID="cost-save-ingredient" style={styles.primaryButton} onPress={commitIngredient}>
                  <Text style={styles.primaryButtonText}>{copy.save}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={countryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.countryModalCard, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <Text style={styles.modalTitle}>{copy.chooseCountry}</Text>
            <TextInput
              testID="energy-country-search"
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder={copy.searchCountries}
              placeholderTextColor={COLORS.muted}
              style={styles.textInput}
              accessibilityLabel={copy.searchCountries}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredCountries.map((country) => (
                <Pressable
                  key={country.code}
                  testID={`energy-country-${country.code}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: state.energy.countryCode === country.code }}
                  onPress={() => requestCountryChange(country.code)}
                  style={styles.countryOption}
                >
                  <Text style={styles.countryButtonText}>{getEnergyCountryLabel(country.code, locale)}</Text>
                  <Text style={styles.costHint}>{country.currency ?? '—'}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setCountryPickerOpen(false)}>
              <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingImport !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingImport(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>{copy.importReplaceTitle}</Text>
            <Text style={styles.bodyText}>{copy.importReplaceBody}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setPendingImport(null)}>
                <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable testID="cost-confirm-import" style={styles.primaryButton} onPress={applyProImport}>
                <Text style={styles.primaryButtonText}>{copy.importReplaceAction}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  headerCopy: { flex: 1, gap: 2 },
  iconButton: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: '800' },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.lg },
  summaryCard: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  energyCard: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm },
  energyTypeList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  energyTypeButton: { minHeight: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  energyTypeButtonSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  energyTypeText: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceSecondary },
  energyTypeTextSelected: { color: '#fff' },
  countryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, backgroundColor: COLORS.surface },
  countryButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  countryOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: SPACING.sm },
  countryModalCard: { height: '90%' },
  energyTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.brand, textAlign: 'right', flexShrink: 1 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  saveStatusText: { color: COLORS.muted, fontSize: 11, flexShrink: 1 },
  batchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  fieldLabel: { fontSize: 13, color: COLORS.onSurfaceSecondary, fontWeight: '600', marginTop: SPACING.sm },
  batchInput: { width: 84, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 9, textAlign: 'center', fontSize: 16, color: COLORS.onSurface },
  emptyText: { fontSize: 14, color: COLORS.muted, lineHeight: 20, paddingVertical: SPACING.sm },
  recipeList: { gap: SPACING.sm },
  recipeItem: { padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, gap: SPACING.xs },
  recipeItemHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  ingredientTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface, flexShrink: 1 },
  recipeInputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  textInput: { minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, color: COLORS.onSurface, backgroundColor: COLORS.surfaceSecondary, fontSize: 15 },
  quantityInput: { flex: 1, minWidth: 62, paddingHorizontal: SPACING.sm },
  unitPickerCompact: { flexDirection: 'row', gap: 2 },
  unitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  unitChip: { minWidth: 40, minHeight: 34, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceSecondary },
  unitChipSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  unitChipText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  unitChipTextSelected: { color: COLORS.onBrandTertiary },
  itemCost: { minWidth: 62, textAlign: 'right', fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  costHint: { color: COLORS.muted, fontSize: 12 },
  warningText: { fontSize: 13, lineHeight: 19, color: '#8A4B08', backgroundColor: '#FFF2D6', borderRadius: RADIUS.md, padding: SPACING.md },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.brand },
  importCard: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm },
  importCopy: { gap: SPACING.xs },
  importTitle: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface },
  bodyText: { fontSize: 13, color: COLORS.muted, lineHeight: 19 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: 42, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSecondary },
  secondaryButtonText: { color: COLORS.brand, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  disabledButton: { borderColor: COLORS.border, backgroundColor: COLORS.surface },
  disabledButtonText: { color: COLORS.muted },
  catalogCard: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  catalogHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  catalogTitleWrap: { flex: 1, gap: SPACING.xs },
  addCustomButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.brand },
  addCustomText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  categoryList: { gap: SPACING.xs, paddingVertical: 2 },
  categoryChip: { minHeight: 36, paddingHorizontal: SPACING.md, justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  categoryChipSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  categoryChipText: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },
  categoryChipTextSelected: { color: '#fff' },
  catalogList: { gap: SPACING.sm },
  catalogItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  catalogItemMain: { flex: 1, gap: SPACING.xs },
  catalogActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  addButton: { minWidth: 60, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.sm, backgroundColor: COLORS.brand },
  addedButton: { backgroundColor: COLORS.surfaceTertiary },
  addButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addedButtonText: { color: COLORS.muted },
  errorText: { color: COLORS.error, fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.48)' },
  modalCard: { maxHeight: '92%', backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },
  confirmCard: { alignSelf: 'center', width: '90%', maxWidth: 460, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface, marginBottom: SPACING.sm },
  readOnlyInput: { color: COLORS.muted, backgroundColor: COLORS.surfaceTertiary },
  packageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  packageInput: { flex: 1, minWidth: 80 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg },
  primaryButton: { minHeight: 44, minWidth: 90, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.brand },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
