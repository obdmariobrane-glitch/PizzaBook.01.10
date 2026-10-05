"""Pizzabook backend server - Community + calculators + storage + push"""
from fastapi import FastAPI, APIRouter, HTTPException, Header, UploadFile, File, Form, Query, Depends
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, secrets, requests, httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Mongo
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Object storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "pizzabook"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    if resp.content.strip() == b"File not found":
        raise HTTPException(status_code=404, detail="Media file not found")
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

def delete_object(path: str):
    key = init_storage()
    resp = requests.delete(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code not in (200, 204, 404):
        resp.raise_for_status()

# Push notifications
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)

async def send_push(recipients: list, data: dict, idempotency_key: str = None):
    if not recipients: return
    if "title" not in data or "message" not in data: return
    payload = {"recipients": recipients, "data": data}
    if idempotency_key: payload["$idempotency_key"] = idempotency_key
    try:
        await push_client.post("/api/v1/push/trigger", json=payload)
    except Exception as e:
        logging.warning(f"push failed: {e}")

app = FastAPI()
api_router = APIRouter(prefix="/api")

@api_router.get("/app-update")
async def app_update():
    version = os.environ.get("APP_VERSION", "1.0.1")
    version_code = int(os.environ.get("APP_VERSION_CODE", "2"))
    apk_url = os.environ.get("APP_APK_URL", "")
    message = os.environ.get("APP_UPDATE_MESSAGE", "Dostupna je nova verzija Pizzabooka.")
    github_url = os.environ.get("GITHUB_REPO_URL", "https://github.com/branimirjeli-svg/pizzabook")
    github_message = os.environ.get(
        "GITHUB_UPDATE_MESSAGE",
        "Nova verzija Pizzabooka je završena. Pogledaj novosti i izvorni kod na GitHubu.",
    )

    # Notify registered devices once when a new app version is configured.
    if (apk_url or github_url) and PUSH_KEY != "placeholder":
        try:
            marker = await db.app_update_notifications.update_one(
                {"version_code": version_code},
                {"$setOnInsert": {"version": version, "created_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
            if marker.upserted_id:
                registrations = await db.push_registrations.find(
                    {}, {"_id": 0, "user_id": 1, "installation_id": 1, "anonymous": 1}
                ).to_list(length=10000)
                anonymous_installations = {
                    registration["installation_id"]
                    for registration in registrations
                    if registration.get("anonymous") and registration.get("installation_id")
                }
                recipients = list({
                    registration["user_id"]
                    for registration in registrations
                    if registration.get("anonymous")
                    or not registration.get("installation_id")
                    or registration.get("installation_id") not in anonymous_installations
                })
                if not recipients:
                    recipients = await db.users.distinct("user_id")
                if apk_url:
                    await send_push(
                        recipients=recipients,
                        data={
                            "title": "Pizzabook update je spreman",
                            "message": message,
                            "action_url": apk_url,
                        },
                        idempotency_key=f"pizzabook-update-{version_code}",
                    )
                await send_push(
                    recipients=recipients,
                    data={
                        "title": "Nova verzija na GitHubu",
                        "message": github_message,
                        "action_url": github_url,
                    },
                    idempotency_key=f"pizzabook-github-{version_code}",
                )
        except Exception as exc:
            logging.warning(f"app update notification failed: {exc}")

    return {
        "version": version,
        "version_code": version_code,
        "apk_url": apk_url,
        "message": message,
        "github_url": github_url,
        "github_message": github_message,
    }

# ============ MODELS ============
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    bio: Optional[str] = ""
    equipment: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionRequest(BaseModel):
    session_id: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    equipment: Optional[str] = None

class RecipeAttachment(BaseModel):
    name: Optional[str] = None
    style_id: Optional[str] = None
    style_params: Optional[dict] = None
    settings: Optional[dict] = None
    ingredients: Optional[dict] = None
    diameter_cm: Optional[float] = None
    hydration: Optional[float] = None
    method: Optional[str] = None
    flour_type: Optional[str] = None
    fermentation_hours: Optional[float] = None
    oven_type: Optional[str] = None
    bake_temp: Optional[float] = None
    dough_weight: Optional[float] = None

class SavedRecipeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    recipe: dict

class SavedRecipeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    recipe: Optional[dict] = None

class PostCreate(BaseModel):
    caption: str
    image_path: Optional[str] = ""
    media: Optional[List[dict]] = None
    recipe: Optional[RecipeAttachment] = None
    author_rating: Optional[int] = None

class CommentCreate(BaseModel):
    text: str

class RatingUpdate(BaseModel):
    rating: int  # 1-5

class RegisterPushBody(BaseModel):
    user_id: str
    installation_id: Optional[str] = None
    anonymous: bool = False
    platform: str
    device_token: str

class ContentReport(BaseModel):
    target_type: Literal["post", "comment"]
    target_id: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=500)

# ============ AUTH ============
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_optional_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None

def add_rating_summary(post: dict, viewer_id: Optional[str] = None):
    ratings = post.get("ratings") or {}
    if not isinstance(ratings, dict):
        ratings = {}
    values = [value for value in ratings.values() if isinstance(value, int) and 1 <= value <= 5]
    post["rating"] = round(sum(values) / len(values), 1) if values else None
    post["ratings_count"] = len(values)
    if viewer_id:
        post["viewer_rating"] = ratings.get(viewer_id)
    post.pop("ratings", None)
    return post

@api_router.post("/auth/session")
async def create_session(body: SessionRequest):
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data.get("email")
    name = data.get("name", email)
    picture = data.get("picture", "")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Missing data")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = User(user_id=user_id, email=email, name=name, picture=picture).dict()
        await db.users.insert_one(user_doc)

    now = datetime.now(timezone.utc)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=7),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}

@api_router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"status": "ok"}

@api_router.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    owned_posts = await db.posts.find({"user_id": user_id}, {"_id": 0, "post_id": 1, "image_path": 1, "media": 1}).to_list(length=10000)
    owned_post_ids = [post["post_id"] for post in owned_posts]
    image_paths = list({
        path
        for post in owned_posts
        for path in [post.get("image_path"), *(item.get("path") for item in post.get("media", []))]
        if path
    })

    comments_to_delete = await db.comments.find(
        {"$or": [{"user_id": user_id}, {"post_id": {"$in": owned_post_ids}}]},
        {"_id": 0, "comment_id": 1, "post_id": 1, "user_id": 1},
    ).to_list(length=10000)
    authored_comments = [comment for comment in comments_to_delete if comment.get("user_id") == user_id]
    comment_post_counts = {}
    for comment in authored_comments:
        comment_post_counts[comment["post_id"]] = comment_post_counts.get(comment["post_id"], 0) + 1

    if comment_post_counts:
        for post_id, count in comment_post_counts.items():
            await db.posts.update_one(
                {"post_id": post_id},
                [{"$set": {"comments_count": {"$max": [0, {"$subtract": [{"$ifNull": ["$comments_count", 0]}, count]}]}}}],
            )
    deleted_comment_ids = [comment["comment_id"] for comment in comments_to_delete if comment.get("comment_id")]
    await db.comments.delete_many({"$or": [{"user_id": user_id}, {"post_id": {"$in": owned_post_ids}}]})
    await db.posts.delete_many({"user_id": user_id})

    liked_posts = await db.posts.find({"likes": user_id}, {"_id": 0, "post_id": 1, "likes": 1}).to_list(length=10000)
    for post in liked_posts:
        likes = [like for like in post.get("likes", []) if like != user_id]
        await db.posts.update_one({"post_id": post["post_id"]}, {"$set": {"likes": likes, "likes_count": len(likes)}})

    report_targets = [{"reporter_id": user_id}]
    if owned_post_ids:
        report_targets.append({"target_type": "post", "target_id": {"$in": owned_post_ids}})
    if deleted_comment_ids:
        report_targets.append({"target_type": "comment", "target_id": {"$in": deleted_comment_ids}})
    await db.reports.delete_many({"$or": report_targets})
    await db.saved_recipes.delete_many({"user_id": user_id})
    await db.push_registrations.delete_many({"user_id": user_id})
    await db.read_tokens.delete_many({"path": {"$in": image_paths}})
    await db.uploads.delete_many({"owner_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})

    for path in image_paths:
        try:
            await run_in_threadpool(delete_object, path)
        except Exception as exc:
            logging.warning(f"account image deletion failed for {path}: {exc}")
    return {"status": "deleted"}

@api_router.patch("/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

# ============ SAVED RECIPES ============
@api_router.get("/recipes")
async def list_saved_recipes(user: dict = Depends(get_current_user)):
    cursor = db.saved_recipes.find(
        {"user_id": user["user_id"]},
        {"_id": 0},
    ).sort("updated_at", -1)
    return await cursor.to_list(length=200)

@api_router.post("/recipes", status_code=201)
async def create_saved_recipe(body: SavedRecipeCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    recipe = {
        "recipe_id": f"recipe_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": body.name.strip(),
        "recipe": body.recipe,
        "created_at": now,
        "updated_at": now,
    }
    await db.saved_recipes.insert_one(recipe)
    recipe.pop("_id", None)
    return recipe

@api_router.patch("/recipes/{recipe_id}")
async def update_saved_recipe(recipe_id: str, body: SavedRecipeUpdate, user: dict = Depends(get_current_user)):
    updates = {key: value for key, value in body.dict().items() if value is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.saved_recipes.update_one(
        {"recipe_id": recipe_id, "user_id": user["user_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Recipe not found")
    return await db.saved_recipes.find_one({"recipe_id": recipe_id}, {"_id": 0})

@api_router.delete("/recipes/{recipe_id}")
async def delete_saved_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    result = await db.saved_recipes.delete_one({"recipe_id": recipe_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Recipe not found")
    return {"status": "deleted"}

# ============ STORAGE ============
class UploadTokenResponse(BaseModel):
    token: str

async def create_read_token(path: str) -> str:
    token = secrets.token_urlsafe(24)
    await db.read_tokens.insert_one({
        "token": token, "path": path,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    return token

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic", "mp4", "mov", "webm", "m4v"):
        ext = "jpg"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Prazna slika")
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    content_types = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "webp": "image/webp", "heic": "image/heic", "mp4": "video/mp4",
        "mov": "video/quicktime", "webm": "video/webm", "m4v": "video/x-m4v",
    }
    ct = file.content_type if file.content_type and (file.content_type.startswith("image/") or file.content_type.startswith("video/")) else content_types[ext]
    result = await run_in_threadpool(put_object, path, content, ct)
    await db.uploads.insert_one({
        "path": result["path"],
        "owner_id": user["user_id"],
        "content_type": ct,
        "created_at": datetime.now(timezone.utc),
    })
    token = await create_read_token(result["path"])
    return {"path": result["path"], "url": f"/api/files/{result['path']}?token={token}"}

@api_router.get("/files/{path:path}")
async def download_file(path: str, token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    upload = await db.uploads.find_one({"path": path}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Not found")
    # accept token OR bearer
    authorized = False
    if token:
        t = await db.read_tokens.find_one({"token": token, "path": path}, {"_id": 0})
        if t:
            exp = t["expires_at"]
            if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
            if exp > datetime.now(timezone.utc):
                authorized = True
    if not authorized and authorization and authorization.startswith("Bearer "):
        # any authenticated user can view (community is open)
        tok = authorization.split(" ", 1)[1]
        session = await db.user_sessions.find_one({"session_token": tok}, {"_id": 0})
        if session:
            authorized = True
    if not authorized:
        # Public read for community images (they are anyway world-viewable)
        authorized = True
    content, ct = await run_in_threadpool(get_object, path)
    if not ct.startswith("image/"):
        content_types = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".webp": "image/webp", ".heic": "image/heic", ".mp4": "video/mp4",
            ".mov": "video/quicktime", ".webm": "video/webm", ".m4v": "video/x-m4v",
        }
        ct = content_types.get(Path(path).suffix.lower(), ct)
    return Response(content=content, media_type=ct)

# ============ COMMUNITY ============
@api_router.post("/posts")
async def create_post(body: PostCreate, user: dict = Depends(get_current_user)):
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    media = body.media or ([{"type": "image", "path": body.image_path}] if body.image_path else [])
    first_image = next((item.get("path", "") for item in media if item.get("type") == "image"), "")
    doc = {
        "post_id": post_id,
        "user_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture", ""),
        "caption": body.caption,
        "image_path": first_image,
        "media": media,
        "recipe": body.recipe.dict() if body.recipe else None,
        "author_rating": body.author_rating if body.author_rating and 1 <= body.author_rating <= 5 else None,
        "ratings": {},
        "likes": [],
        "likes_count": 0,
        "comments_count": 0,
        "created_at": now,
    }
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return doc

async def attach_media_urls(post: dict):
    media = post.get("media") or ([{"type": "image", "path": post["image_path"]}] if post.get("image_path") else [])
    media_urls = []
    for item in media:
        path = item.get("path")
        if not path:
            continue
        token = await create_read_token(path)
        media_urls.append({
            "type": "video" if item.get("type") == "video" else "image",
            "url": f"/api/files/{path}?token={token}",
        })
    post["media_urls"] = media_urls
    if media_urls:
        first_image = next((item["url"] for item in media_urls if item["type"] == "image"), None)
        post["image_url"] = first_image or media_urls[0]["url"]
    return post

@api_router.get("/posts")
async def list_posts(skip: int = 0, limit: int = 20, method: Optional[str] = None, user: Optional[dict] = Depends(get_optional_user)):
    query = {}
    if method and method in ("direct", "biga", "poolish"):
        query["recipe.method"] = method
    cursor = db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    posts = await cursor.to_list(length=limit)
    # attach signed url
    for p in posts:
        await attach_media_urls(p)
        add_rating_summary(p, user["user_id"] if user else None)
    return posts

@api_router.get("/posts/featured")
async def featured_post():
    """Recipe of the week: top-liked post from past 7 days, must have an image."""
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    cursor = db.posts.find(
        {"created_at": {"$gte": week_ago}, "image_path": {"$ne": ""}},
        {"_id": 0}
    ).sort([("likes_count", -1), ("created_at", -1)]).limit(1)
    posts = await cursor.to_list(length=1)
    if not posts:
        return None
    p = posts[0]
    if p.get("likes_count", 0) < 1:
        return None
    await attach_media_urls(p)
    return add_rating_summary(p)

@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, user: Optional[dict] = Depends(get_optional_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Not found")
    await attach_media_urls(post)
    return add_rating_summary(post, user["user_id"] if user else None)

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Not found")
    if post["user_id"] != user["user_id"]:
        raise HTTPException(403, "You can only delete your own posts")

    media_paths = list({
        path
        for path in [post.get("image_path"), *(item.get("path") for item in post.get("media", []))]
        if path
    })
    await db.comments.delete_many({"post_id": post_id})
    await db.reports.delete_many({"target_type": "post", "target_id": post_id})
    await db.posts.delete_one({"post_id": post_id})
    if media_paths:
        await db.read_tokens.delete_many({"path": {"$in": media_paths}})
        await db.uploads.delete_many({"path": {"$in": media_paths}, "owner_id": user["user_id"]})
    for media_path in media_paths:
        try:
            await run_in_threadpool(delete_object, media_path)
        except Exception as exc:
            logging.warning(f"post media deletion failed for {media_path}: {exc}")
    return {"status": "deleted"}

@api_router.post("/posts/{post_id}/rating")
async def set_rating(post_id: str, body: RatingUpdate, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Not found")
    if post["user_id"] == user["user_id"]:
        raise HTTPException(403, "You cannot rate your own pizza")
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(400, "Rating must be 1-5")
    await db.posts.update_one(
        {"post_id": post_id},
        {"$set": {f"ratings.{user['user_id']}": body.rating}},
    )
    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return add_rating_summary(updated, user["user_id"])

@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Not found")
    uid = user["user_id"]
    likes = set(post.get("likes", []))
    if uid in likes:
        likes.remove(uid)
    else:
        likes.add(uid)
    likes_list = list(likes)
    await db.posts.update_one({"post_id": post_id}, {"$set": {"likes": likes_list, "likes_count": len(likes_list)}})
    return {"liked": uid in likes, "likes_count": len(likes_list)}

@api_router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str):
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(length=200)

@api_router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, body: CommentCreate, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Not found")
    comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {
        "comment_id": comment_id,
        "post_id": post_id,
        "user_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture", ""),
        "text": body.text,
        "created_at": now,
    }
    await db.comments.insert_one(doc)
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    # notify post author
    if post["user_id"] != user["user_id"]:
        try:
            await send_push(
                recipients=[post["user_id"]],
                data={"title": user["name"], "message": body.text[:100], "action_url": f"/post/{post_id}"},
            )
        except Exception as e:
            logging.warning(f"push fail: {e}")
    doc.pop("_id", None)
    return doc

@api_router.post("/reports", status_code=201)
async def report_content(body: ContentReport, user: dict = Depends(get_current_user)):
    collection = db.posts if body.target_type == "post" else db.comments
    target = await collection.find_one({"post_id" if body.target_type == "post" else "comment_id": body.target_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Content not found")
    existing = await db.reports.find_one({"reporter_id": user["user_id"], "target_type": body.target_type, "target_id": body.target_id})
    if existing:
        return {"status": "already_reported"}
    await db.reports.insert_one({
        "reporter_id": user["user_id"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    })
    return {"status": "reported"}

# ============ PUSH ============
@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    if not PUSH_KEY or PUSH_KEY == "placeholder":
        # Preview environment - push key set at deploy time. Accept but skip upstream.
        return {"status": "pending_deploy"}
    try:
        provider_payload = {
            "user_id": body.user_id,
            "platform": body.platform,
            "device_token": body.device_token,
        }
        await db.push_registrations.update_one(
            {"user_id": body.user_id, "device_token": body.device_token},
            {"$set": body.model_dump()},
            upsert=True,
        )
        resp = await push_client.post("/api/v1/push/users/register", json=provider_payload)
        if resp.status_code == 401:
            raise HTTPException(500, "PUSH key missing")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logging.warning(f"push register fail: {e}")
    return {"status": "registered"}

# ============ HEALTH ============
@api_router.get("/")
async def root():
    return {"status": "ok", "app": "pizzabook"}

# indexes on startup
@app.on_event("startup")
async def on_startup():
    try:
        init_storage()
    except Exception as e:
        logging.warning(f"storage init failed (will retry): {e}")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.read_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.posts.create_index("created_at")
    await db.comments.create_index("post_id")
    await db.push_registrations.create_index([("user_id", 1), ("device_token", 1)], unique=True)
    await db.reports.create_index([("reporter_id", 1), ("target_type", 1), ("target_id", 1)], unique=True)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await push_client.aclose()
