import React, { ReactNode } from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme';

type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: { marker: string; text: string }[] }
  | { type: 'rule' }
  | { type: 'table'; header: string[]; rows: string[][] };

type InlinePart =
  | { type: 'text' | 'bold' | 'italic' | 'code'; text: string }
  | { type: 'link'; text: string; href: string };

type MarkdownContentProps = {
  markdown: string;
  onLinkPress: (href: string) => void;
  testID?: string;
};

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isTableDivider(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      const tableRows = tableLines.map(splitTableRow);
      const hasHeader = tableRows.length > 1 && isTableDivider(tableRows[1]);
      blocks.push({
        type: 'table',
        header: hasHeader ? tableRows[0] : [],
        rows: tableRows.slice(hasHeader ? 2 : 0),
      });
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoted: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoted.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quoted.join(' ') });
      continue;
    }

    const listMatch = line.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items: { marker: string; text: string }[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^([-*]|\d+\.)\s+(.*)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push({ marker: ordered ? item[1] : '•', text: item[2] });
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current
        || current.startsWith('|')
        || current.startsWith('>')
        || /^(?:-{3,}|\*{3,}|_{3,})$/.test(current)
        || /^([-*]|\d+\.)\s+/.test(current)
      ) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function parseInline(text: string): InlinePart[] {
  const token = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  const parts: InlinePart[] = [];
  let position = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(text)) !== null) {
    if (match.index > position) parts.push({ type: 'text', text: text.slice(position, match.index) });
    if (match[1] !== undefined) parts.push({ type: 'link', text: match[1], href: match[2] });
    else if (match[3] !== undefined) parts.push({ type: 'bold', text: match[3] });
    else if (match[4] !== undefined) parts.push({ type: 'code', text: match[4] });
    else if (match[5] !== undefined) parts.push({ type: 'italic', text: match[5] });
    position = match.index + match[0].length;
  }
  if (position < text.length) parts.push({ type: 'text', text: text.slice(position) });
  return parts;
}

function renderInlineParts(text: string, onLinkPress: (href: string) => void, prefix: string): ReactNode[] {
  return parseInline(text).map((part, index) => {
    const key = `${prefix}-${index}`;
    if (part.type === 'link') {
      return (
        <Text
          key={key}
          accessibilityRole="link"
          onPress={() => onLinkPress(part.href)}
          style={styles.link}
        >
          {renderInlineParts(part.text, onLinkPress, key)}
        </Text>
      );
    }
    if (part.type === 'bold') return <Text key={key} style={styles.bold}>{part.text}</Text>;
    if (part.type === 'italic') return <Text key={key} style={styles.italic}>{part.text}</Text>;
    if (part.type === 'code') return <Text key={key} style={styles.code}>{part.text}</Text>;
    return <Text key={key}>{part.text}</Text>;
  });
}

function InlineText({
  text,
  onLinkPress,
  style,
}: {
  text: string;
  onLinkPress: (href: string) => void;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.inlineText, style]}>{renderInlineParts(text, onLinkPress, 'inline')}</Text>;
}

export default function MarkdownContent({ markdown, onLinkPress, testID }: MarkdownContentProps) {
  const { width } = useWindowDimensions();
  const blocks = parseBlocks(markdown);

  return (
    <View testID={testID} style={styles.document}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === 'paragraph') {
          return <InlineText key={key} text={block.text} onLinkPress={onLinkPress} style={styles.paragraph} />;
        }
        if (block.type === 'quote') {
          return (
            <View key={key} style={styles.quote}>
              <InlineText text={block.text} onLinkPress={onLinkPress} style={styles.quoteText} />
            </View>
          );
        }
        if (block.type === 'rule') return <View key={key} style={styles.rule} />;
        if (block.type === 'list') {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={`${key}-${itemIndex}`} style={styles.listItem}>
                  <Text style={styles.listMarker}>{item.marker}</Text>
                  <InlineText text={item.text} onLinkPress={onLinkPress} style={styles.listText} />
                </View>
              ))}
            </View>
          );
        }

        const columnCount = Math.max(block.header.length, ...block.rows.map((row) => row.length), 1);
        const tableWidth = Math.max(Math.min(width - SPACING.xl * 2, 760), columnCount * 112);
        const cellWidth = tableWidth / columnCount;
        return (
          <View key={key} style={styles.tableOuter}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.tableScrollContent}
            >
              <View style={[styles.table, { width: tableWidth }]}>
                {block.header.length > 0 ? (
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    {block.header.map((cell, cellIndex) => (
                      <View key={`${key}-head-${cellIndex}`} style={[styles.tableCell, { width: cellWidth }]}>
                        <InlineText text={cell} onLinkPress={onLinkPress} style={styles.tableHeaderText} />
                      </View>
                    ))}
                  </View>
                ) : null}
                {block.rows.map((row, rowIndex) => (
                  <View key={`${key}-row-${rowIndex}`} style={[styles.tableRow, rowIndex % 2 === 1 && styles.tableAlternate]}>
                    {Array.from({ length: columnCount }, (_, cellIndex) => (
                      <View key={`${key}-${rowIndex}-${cellIndex}`} style={[styles.tableCell, { width: cellWidth }]}>
                        <InlineText text={row[cellIndex] ?? ''} onLinkPress={onLinkPress} style={styles.tableCellText} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  document: { gap: SPACING.sm },
  inlineText: { color: COLORS.onSurface, fontSize: 16, lineHeight: 25 },
  paragraph: { marginBottom: SPACING.sm },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', backgroundColor: COLORS.surfaceTertiary, color: COLORS.onSurface, fontSize: 14 },
  link: { color: COLORS.brand, textDecorationLine: 'underline' },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.brand,
    backgroundColor: COLORS.surfaceTertiary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  quoteText: { fontStyle: 'italic' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  list: { gap: SPACING.sm, marginBottom: SPACING.md },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  listMarker: { color: COLORS.brand, fontSize: 16, lineHeight: 25, minWidth: 22, fontWeight: '700' },
  listText: { flex: 1 },
  tableOuter: { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: 'hidden', marginVertical: SPACING.sm },
  tableScrollContent: { minWidth: '100%' },
  table: { alignSelf: 'flex-start' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  tableHeader: { backgroundColor: COLORS.surfaceTertiary },
  tableAlternate: { backgroundColor: COLORS.surfaceSecondary },
  tableCell: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: COLORS.border },
  tableHeaderText: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  tableCellText: { fontSize: 14, lineHeight: 20 },
});
