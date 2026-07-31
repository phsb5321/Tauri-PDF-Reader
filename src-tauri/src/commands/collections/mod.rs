//! Shelf command handlers
//!
//! Tauri commands for organising library documents into named shelves.
//! A document may sit on any number of shelves; reading progress stays on the
//! document, so filing a book never moves or duplicates where it was left off.

mod db;

use crate::commands::library::db::get_pool;
use crate::db::models::{Collection, CollectionMembership};
use tauri::State;
use tauri_plugin_sql::DbInstances;

/// Create a shelf.
#[tauri::command]
#[specta::specta]
pub async fn collections_create(
    db: State<'_, DbInstances>,
    name: String,
) -> Result<Collection, String> {
    let pool = get_pool(&db).await?;
    db::create(&pool, &uuid::Uuid::new_v4().to_string(), &name).await
}

/// Every shelf, ordered by name, each with its document count.
#[tauri::command]
#[specta::specta]
pub async fn collections_list(db: State<'_, DbInstances>) -> Result<Vec<Collection>, String> {
    let pool = get_pool(&db).await?;
    db::list(&pool).await
}

/// Rename a shelf.
#[tauri::command]
#[specta::specta]
pub async fn collections_rename(
    db: State<'_, DbInstances>,
    id: String,
    name: String,
) -> Result<Collection, String> {
    let pool = get_pool(&db).await?;
    db::rename(&pool, &id, &name).await
}

/// Delete a shelf. The documents filed on it stay in the library.
#[tauri::command]
#[specta::specta]
pub async fn collections_delete(db: State<'_, DbInstances>, id: String) -> Result<(), String> {
    let pool = get_pool(&db).await?;
    db::delete(&pool, &id).await
}

/// File a document on a shelf.
#[tauri::command]
#[specta::specta]
pub async fn collections_add_document(
    db: State<'_, DbInstances>,
    collection_id: String,
    document_id: String,
) -> Result<(), String> {
    let pool = get_pool(&db).await?;
    db::add_document(&pool, &collection_id, &document_id).await
}

/// Take a document off a shelf.
#[tauri::command]
#[specta::specta]
pub async fn collections_remove_document(
    db: State<'_, DbInstances>,
    collection_id: String,
    document_id: String,
) -> Result<(), String> {
    let pool = get_pool(&db).await?;
    db::remove_document(&pool, &collection_id, &document_id).await
}

/// Every (document, shelf) pair, loaded in one call.
#[tauri::command]
#[specta::specta]
pub async fn collections_list_memberships(
    db: State<'_, DbInstances>,
) -> Result<Vec<CollectionMembership>, String> {
    let pool = get_pool(&db).await?;
    db::list_memberships(&pool).await
}
