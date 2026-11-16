//! AI deck analysis and saved deck questions (`Manavault.AI`).
//!
//! Provider settings live in [`manavault_core::settings::ai`]. Analyses of saved
//! decks and deck questions run in Oban-compatible background jobs on the
//! `ai` queue ([`workers`]); pasted or linked decklists are analyzed inline and
//! saved as [`requests`]. Providers are OpenRouter and OpenAI-compatible servers.

pub mod analyze_deck;
pub mod analyze_deck_list;
pub mod answer_deck_question;
pub mod card_categories;
pub mod deck_analysis;
pub mod deck_question;
pub mod decks;
pub mod openrouter;
mod prompt_text;
pub mod question_answers;
pub mod requests;
pub mod schema;
pub mod tools;
pub mod workers;

#[cfg(test)]
pub(crate) mod tests;

use manavault_core::settings::ai::AiSettings;

pub use deck_analysis::bracket_label;
pub use schema::{AiMutations, AiQueries};

const NOT_CONFIGURED: &str = "Configure an AI provider and model in Settings first.";
const UNSUPPORTED_PROVIDER: &str = "The selected AI provider is not supported.";

/// A failure with a user-facing message or an internal cause.
#[derive(Debug, thiserror::Error)]
pub enum AiError {
    /// Shown to the user as is.
    #[error("{0}")]
    User(String),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
    #[error("{0}")]
    Internal(String),
}

impl From<manavault_core::jobs::JobError> for AiError {
    fn from(error: manavault_core::jobs::JobError) -> Self {
        match error {
            manavault_core::jobs::JobError::Db(error) => Self::Db(error),
            other @ manavault_core::jobs::JobError::UnknownWorker(_) => {
                Self::Internal(other.to_string())
            }
        }
    }
}

impl AiError {
    /// The GraphQL error: the message, or "Something went wrong." for
    /// internal failures.
    #[must_use]
    pub fn into_graphql(self) -> async_graphql::Error {
        match self {
            Self::User(message) => manavault_core::graphql::user_error(message),
            other => manavault_core::graphql::internal_error(other),
        }
    }
}

/// The AI providers (`Provider.module/1`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    OpenRouter,
    OpenAiCompatible,
}

/// Settings required to call the selected provider.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Configured {
    pub provider: String,
    pub api_key: String,
    pub api_base_url: String,
    pub model: String,
    pub deck_analysis_instructions: Option<String>,
    /// The decision model that assigns AI tags to deck cards.
    pub decision_model: String,
    /// `OpenRouter`'s `reasoning.effort`; `None` leaves the model's default.
    pub reasoning_effort: Option<String>,
}

impl Configured {
    /// `UpdateSettings.configured/1`.
    pub fn from_settings(settings: AiSettings) -> Result<Self, AiError> {
        if !matches!(
            settings.provider.as_str(),
            "openrouter" | "openai-compatible"
        ) {
            return Err(AiError::User(UNSUPPORTED_PROVIDER.to_owned()));
        }
        let is_openrouter = settings.provider == "openrouter";
        let decision_model = settings.decision_model().to_owned();
        let has_key = settings.has_api_key();
        let model = settings
            .model
            .filter(|model| !model.trim().is_empty())
            .ok_or_else(|| AiError::User(NOT_CONFIGURED.to_owned()))?;
        if is_openrouter && !has_key {
            return Err(AiError::User(NOT_CONFIGURED.to_owned()));
        }
        let api_base_url = if is_openrouter {
            String::new()
        } else {
            settings
                .api_base_url
                .as_deref()
                .map(|url| url.trim_end_matches('/'))
                .filter(|url| !url.is_empty())
                .ok_or_else(|| AiError::User(NOT_CONFIGURED.to_owned()))?
                .to_owned()
        };
        Ok(Self {
            provider: settings.provider,
            api_key: settings.api_key.unwrap_or_default(),
            api_base_url,
            model,
            decision_model,
            deck_analysis_instructions: settings.deck_analysis_instructions,
            reasoning_effort: settings.reasoning_effort,
        })
    }

    /// Loads and checks the saved settings.
    pub async fn load(state: &manavault_core::state::AppState) -> Result<Self, AiError> {
        Self::from_settings(manavault_core::settings::ai::settings(state).await?)
    }

    /// `Provider.module/1`.
    pub fn provider(&self) -> Result<Provider, AiError> {
        match self.provider.as_str() {
            "openrouter" => Ok(Provider::OpenRouter),
            "openai-compatible" => Ok(Provider::OpenAiCompatible),
            _ => Err(AiError::User(UNSUPPORTED_PROVIDER.to_owned())),
        }
    }
}
