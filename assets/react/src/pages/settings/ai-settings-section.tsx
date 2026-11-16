import { useApolloClient, useMutation, useQuery } from "@apollo/client/react"
import { Bot, RefreshCw, Save } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { PageSection } from "../../components/app-shell"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Textarea } from "../../components/ui/textarea"
import { useToast } from "../../components/ui/toast"
import type { AiSettingsQuery } from "../../gql/graphql"
import { useDebouncedValue } from "../collection/form-helpers"
import {
  AIModelReasoningDocument,
  AISettingsDocument,
  RefreshAllDeckAnalysesDocument,
  UpdateAISettingsDocument,
  errorMessage,
} from "./data"
import { Field } from "./ui"

type AISettings = NonNullable<AiSettingsQuery["aiSettings"]>

/** The select value for sending no effort, which leaves the model's default. */
const MODEL_DEFAULT = "default"

const EFFORT_LABELS: Record<string, string> = {
  max: "Max",
  xhigh: "Extra high",
  high: "High",
  medium: "Medium",
  low: "Low",
  minimal: "Minimal",
  none: "Off",
}

function effortLabel(effort: string) {
  return EFFORT_LABELS[effort] ?? effort
}

export function AISettingsSection() {
  const settingsQuery = useQuery(AISettingsDocument, { fetchPolicy: "cache-and-network" })
  const settings = settingsQuery.data?.aiSettings

  return (
    <PageSection title="AI analysis" count="Provider settings">
      {settingsQuery.error ? (
        <p className="text-sm text-error" role="alert">
          {errorMessage(settingsQuery.error)}
        </p>
      ) : null}
      {settings ? (
        <AISettingsForm settings={settings} />
      ) : settingsQuery.error ? null : (
        <p className="text-sm text-base-content/60" role="status">
          Loading AI settings...
        </p>
      )}
    </PageSection>
  )
}

function AISettingsForm({ settings }: { settings: AISettings }) {
  const client = useApolloClient()
  const { showToast } = useToast()
  const [provider, setProvider] = useState(settings.provider)
  const [apiKey, setApiKey] = useState("")
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl ?? "")
  const [model, setModel] = useState(settings.model ?? "")
  const [deckAnalysisInstructions, setDeckAnalysisInstructions] = useState(
    settings.deckAnalysisInstructions ?? "",
  )
  const [decisionModel, setDecisionModel] = useState(settings.decisionModel)
  const [reasoningEffort, setReasoningEffort] = useState(settings.reasoningEffort ?? "")
  const lookupModel = useDebouncedValue(model.trim(), 400)
  const isOpenRouter = provider === "openrouter"
  const hasSavedApiKey = settings.hasApiKey && settings.provider === provider
  const reasoningQuery = useQuery(AIModelReasoningDocument, {
    variables: { model: lookupModel },
    skip: !lookupModel || !isOpenRouter,
  })
  const loadedReasoning =
    lookupModel && lookupModel === model.trim() && reasoningQuery.data && !reasoningQuery.loading
  const supportedEfforts = reasoningQuery.data?.aiModelReasoning?.supportedEfforts ?? []
  const defaultEffort = reasoningQuery.data?.aiModelReasoning?.defaultEffort
  // Once the model's efforts are known, an effort it does not accept falls back to its default.
  const effort =
    loadedReasoning && !supportedEfforts.includes(reasoningEffort) ? "" : reasoningEffort
  const [updateSettings, updateMutation] = useMutation(UpdateAISettingsDocument)
  const [refreshAllDeckAnalyses, refreshMutation] = useMutation(RefreshAllDeckAnalysesDocument)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    void updateSettings({
      variables: {
        input: {
          provider,
          apiBaseUrl: isOpenRouter ? null : apiBaseUrl,
          model,
          deckAnalysisInstructions,
          decisionModel,
          reasoningEffort: isOpenRouter ? effort || null : null,
          ...(apiKey.trim() ? { apiKey } : {}),
        },
      },
      onCompleted: (data) => {
        const nextSettings = data.updateAiSettings?.aiSettings
        setApiKey("")
        if (nextSettings) {
          setDecisionModel(nextSettings.decisionModel)
          setReasoningEffort(nextSettings.reasoningEffort ?? "")
          client.writeQuery({ query: AISettingsDocument, data: { aiSettings: nextSettings } })
        }
        showToast("AI settings validated and saved.")
      },
      onError: (error) => showToast(errorMessage(error), { tone: "error" }),
    })
  }

  function refreshAll() {
    void refreshAllDeckAnalyses({
      onCompleted: (data) => {
        const count = data.refreshAllDeckAnalyses?.queuedCount ?? 0
        const noun = count === 1 ? "deck" : "decks"
        showToast(`Queued AI analysis refresh for ${count} ${noun}.`)
      },
      onError: (error) => showToast(errorMessage(error), { tone: "error" }),
    })
  }

  return (
    <form onSubmit={submit} className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-6 p-6">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-2xl font-black tracking-normal">Deck analysis provider</h2>
            <p className="mt-1 max-w-[72ch] text-sm text-base-content/60">
              Saving validates the model and checks OpenRouter credentials or the compatible API
              URL.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provider" htmlFor="ai-provider">
            <Select
              value={provider}
              onValueChange={(value) => {
                setProvider(value)
                setDecisionModel(value === "openai-compatible" ? "" : "typesafe/jev-1.13")
              }}
            >
              <SelectTrigger id="ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {!isOpenRouter ? (
            <Field
              label="API base URL"
              htmlFor="ai-api-base-url"
              help="For example, http://localhost:1234/v1. The server must be reachable from ManaVault."
            >
              <Input
                id="ai-api-base-url"
                type="url"
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder="http://localhost:1234/v1"
                autoComplete="url"
                required
              />
            </Field>
          ) : null}

          <Field
            label="Model ID"
            htmlFor="ai-model"
            help={
              isOpenRouter
                ? "Use an OpenRouter model ID, such as anthropic/claude-sonnet-4."
                : "Use a model ID exposed by the compatible API server."
            }
          >
            <Input
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={isOpenRouter ? "provider/model-name" : "model-name"}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            label={isOpenRouter ? "OpenRouter API key" : "API key (optional)"}
            htmlFor="ai-api-key"
            help={hasSavedApiKey ? "Leave blank to keep the saved key." : undefined}
          >
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasSavedApiKey ? "Saved" : isOpenRouter ? "sk-or-v1-…" : "Optional"}
              autoComplete="new-password"
              required={isOpenRouter && !hasSavedApiKey}
            />
          </Field>

          {isOpenRouter ? (
            <Field
              label="Reasoning effort"
              htmlFor="ai-reasoning-effort"
              help={reasoningHelp({
                loaded: Boolean(loadedReasoning),
                error: reasoningQuery.error ? errorMessage(reasoningQuery.error) : null,
                adjustable: supportedEfforts.length > 0,
              })}
            >
              <Select
                value={effort || MODEL_DEFAULT}
                onValueChange={(value) => setReasoningEffort(value === MODEL_DEFAULT ? "" : value)}
                disabled={!supportedEfforts.length && !effort}
              >
                <SelectTrigger id="ai-reasoning-effort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MODEL_DEFAULT}>
                    {defaultEffort
                      ? `Model default (${effortLabel(defaultEffort)})`
                      : "Model default"}
                  </SelectItem>
                  {supportedEfforts.map((value) => (
                    <SelectItem key={value} value={value}>
                      {effortLabel(value)}
                    </SelectItem>
                  ))}
                  {effort && !supportedEfforts.includes(effort) ? (
                    <SelectItem value={effort}>{effortLabel(effort)}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>

        <div className="border-t border-base-300 pt-5">
          <h3 className="text-lg font-black">Deck analysis instructions</h3>
          <p className="mt-1 max-w-[72ch] text-sm text-base-content/60">
            Tailor every deck analysis to your preferences. You can rule out recommendations or
            request extra sections such as budget upgrades.
          </p>
          <div className="mt-4">
            <Field
              label="Custom instructions"
              htmlFor="ai-deck-analysis-instructions"
              help="Applied only when analyzing a deck. Maximum 4,000 characters."
            >
              <Textarea
                id="ai-deck-analysis-instructions"
                value={deckAnalysisInstructions}
                onChange={(event) => setDeckAnalysisInstructions(event.target.value)}
                placeholder={"For example: “Never suggest infinite combos.”"}
                rows={6}
                maxLength={4000}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-base-300 pt-5">
          <h3 className="text-lg font-black">AI tags</h3>
          <p className="mt-1 max-w-[72ch] text-sm text-base-content/60">
            After an analysis, a decision model sorts each card into the deck&apos;s AI tags.
            Changing the model re-sorts each deck the next time it opens.
          </p>
          <div className="mt-4 max-w-md">
            <Field
              label="Decision model ID"
              htmlFor="ai-decision-model"
              help={
                isOpenRouter
                  ? "An OpenRouter decision model. Leave blank for typesafe/jev-1.13."
                  : "Optional model ID on this API server. Leave blank to use the selected model."
              }
            >
              <Input
                id="ai-decision-model"
                value={decisionModel}
                onChange={(event) => setDecisionModel(event.target.value)}
                placeholder={isOpenRouter ? "typesafe/jev-1.13" : model || "Model ID"}
                autoComplete="off"
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-base-300 pt-5">
          <h3 className="text-lg font-black">Refresh deck analyses</h3>
          <p className="mt-1 max-w-[72ch] text-sm text-base-content/60">
            Queue a fresh analysis for every non-archived deck using the current model and
            instructions. This may use significant provider credits for a large deck collection.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={refreshAll}
              disabled={
                (isOpenRouter && !settings.hasApiKey) || !settings.model || refreshMutation.loading
              }
              className="disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {refreshMutation.loading ? "Queueing..." : "Refresh all deck analyses"}
            </Button>
          </div>
        </div>

        <div>
          <Button type="submit" disabled={updateMutation.loading}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {updateMutation.loading ? "Validating..." : "Validate and save"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function reasoningHelp({
  loaded,
  error,
  adjustable,
}: {
  loaded: boolean
  error: string | null
  adjustable: boolean
}) {
  if (error) return `Could not load this model's reasoning options. ${error}`
  if (!loaded) return "Options follow the selected model."
  if (!adjustable) return "This model has no adjustable reasoning effort."
  return "Higher effort can give better answers but takes longer and uses more credits."
}
