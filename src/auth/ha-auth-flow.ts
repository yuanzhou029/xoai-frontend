/* eslint-disable lit/prefer-static-styles */
import { genClientId } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { keyed } from "lit/directives/keyed";
import type { LocalizeFunc } from "../common/translations/localize";
import "../components/ha-alert";
import "../components/ha-button";
import "../components/ha-checkbox";
import { computeInitialHaFormData } from "../components/ha-form/compute-initial-ha-form-data";
import "../components/ha-formfield";
import type { AuthProvider } from "../data/auth";
import {
  autocompleteLoginFields,
  createLoginFlow,
  deleteLoginFlow,
  redirectWithAuthCode,
  submitLoginFlow,
} from "../data/auth";
import type {
  DataEntryFlowStep,
  DataEntryFlowStepForm,
} from "../data/data_entry_flow";
import "./ha-auth-form";
import type { HaAuthForm } from "./ha-auth-form";

type State = "loading" | "error" | "step";

@customElement("ha-auth-flow")
export class HaAuthFlow extends LitElement {
  @property({ attribute: false }) public authProvider?: AuthProvider;

  @property({ attribute: false }) public clientId?: string;

  @property({ attribute: false }) public redirectUri?: string;

  @property({ attribute: false }) public oauth2State?: string;

  @property({ attribute: false }) public localize!: LocalizeFunc;

  @property({ attribute: false }) public step?: DataEntryFlowStep;

  @property({ attribute: false }) public initStoreToken = false;

  @state() private _storeToken = false;

  @state() private _state: State = "loading";

  @state() private _stepData?: Record<string, any>;

  @state() private _errorMessage?: string;

  @state() private _submitting = false;

  @query("ha-auth-form") private _form?: HaAuthForm;

  createRenderRoot() {
    return this;
  }

  willUpdate(changedProps: PropertyValues) {
    super.willUpdate(changedProps);

    if (!this.hasUpdated && this.clientId === genClientId()) {
      // Preselect store token when logging in to own instance
      this._storeToken = this.initStoreToken;
    }

    if (!changedProps.has("step")) {
      return;
    }

    if (!this.step) {
      this._stepData = undefined;
      return;
    }

    this._state = "step";

    const oldStep = changedProps.get("step") as HaAuthFlow["step"];

    if (
      !oldStep ||
      this.step.flow_id !== oldStep.flow_id ||
      (this.step.type === "form" &&
        oldStep.type === "form" &&
        this.step.step_id !== oldStep.step_id)
    ) {
      this._stepData =
        this.step.type === "form"
          ? computeInitialHaFormData(this.step.data_schema)
          : undefined;
    }
  }

  protected render() {
    return html`
      <style>
        ha-auth-flow {
          display: block;
          width: 100%;
        }
        ha-auth-flow .store-token {
          margin-left: -16px;
          margin-inline-start: -16px;
          margin-inline-end: initial;
        }
        a.forgot-password {
          color: #60a5fa;
          text-decoration: none;
          font-size: 0.875rem;
          white-space: nowrap;
          transition: color 0.2s;
          font-weight: 500;
        }
        a.forgot-password:hover {
          color: #93c5fd;
          text-decoration: underline;
        }
        .space-between {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          margin-bottom: 8px;
          padding: 0 4px;
        }
        /* 【新增】确保 .action 容器没有背景或边框 */
        .action {
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
        }
        form {
          text-align: center;
          max-width: 336px;
          width: 100%;
          margin: 0 auto;
        }
        ha-auth-form {
          display: block;
          margin-top: 20px;
          margin-bottom: 8px;
        }
        .action ha-button {
          width: 100%;
          margin-top: 8px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          color: white;
          font-weight: 600;
          font-size: 1rem;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
          /* 【新增】确保按钮没有额外的边框或底框 */
          outline: none;
          position: relative;
          overflow: hidden;
        }
        .action ha-button:hover {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.3);
          transform: translateY(-1px);
          /* 【新增】确保悬停状态也没有额外边框 */
          outline: none;
        }
        .action ha-button:active {
          transform: translateY(0);
        }
        h1.welcome-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #f8fafc;
          line-height: 1.3;
          letter-spacing: 0.5px;
        }
        .subtitle-text {
          font-size: 0.95rem;
          color: #94a3b8;
          margin: 0 0 20px 0;
          line-height: 1.5;
        }
        /* 适配透明卡片的表单样式 */
        ha-auth-form input,
        ha-auth-form ha-textfield {
          --ha-text-field-background: rgba(255, 255, 255, 0.08);
          --ha-text-field-border: 1px solid rgba(255, 255, 255, 0.15);
          --ha-text-field-border-radius: 8px;
          --ha-text-field-color: #ffffff;  /* 【优化】从 #f1f5f9 提升到纯白色，提高对比度 */
          --ha-text-field-placeholder-color: #94a3b8;  /* 【优化】从 #64748b 提升到更浅的灰色 */
        }
        /* 复选框样式 */
        ha-formfield {
          color: #cbd5e1;
          font-size: 0.9rem;
        }
        /* 【优化】密码可见图标颜色为浅蓝色，与主题协调 */
        ha-auth-form ha-icon-button {
          --mdc-icon-button-icon-color: #60a5fa;
          color: #60a5fa;
        }
        ha-checkbox {
          --ha-checkbox-background: rgba(255, 255, 255, 0.1);
          --ha-checkbox-border: 1px solid rgba(255, 255, 255, 0.2);
          --ha-checkbox-checked-color: #60a5fa;
        }
      </style>
      <form>${this._renderForm()}</form>
    `;
  }

  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);

    if (this.clientId == null || this.redirectUri == null) {
      // eslint-disable-next-line no-console
      console.error(
        "clientId and redirectUri must not be null",
        this.clientId,
        this.redirectUri
      );
      this._state = "error";
      this._errorMessage = this._unknownError();
      return;
    }

    this.addEventListener("keypress", (ev) => {
      if (ev.key === "Enter") {
        this._handleSubmit(ev);
      }
    });
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (changedProps.has("authProvider")) {
      this._providerChanged(this.authProvider);
    }

    if (!changedProps.has("step") || this.step?.type !== "form") {
      return;
    }

    // 100ms to give all the form elements time to initialize.
    setTimeout(() => {
      const form = this.renderRoot.querySelector("ha-form");
      if (form) {
        (form as any).focus();
      }
    }, 100);
  }

  private _renderForm() {
    switch (this._state) {
      case "step":
        if (this.step == null) {
          return nothing;
        }

        return html`
          ${this._renderStep(this.step)}
          <div class="action">
            <ha-button
              @click=${this._handleSubmit}
              .loading=${this._submitting}
            >
              ${this.step.type === "form"
                ? this.localize("ui.panel.page-authorize.form.next")
                : this.localize("ui.panel.page-authorize.form.start_over")}
            </ha-button>
          </div>
        `;
      case "error":
        return html`
          <ha-alert alert-type="error">
            ${this.localize("ui.panel.page-authorize.form.error", {
              error: this._errorMessage,
            })}
          </ha-alert>
          <div class="action">
            <ha-button @click=${this._startOver}>
              ${this.localize("ui.panel.page-authorize.form.start_over")}
            </ha-button>
          </div>
        `;
      case "loading":
        return html`
          <ha-alert alert-type="info">
            ${this.localize("ui.panel.page-authorize.form.working")}
          </ha-alert>
        `;
      default:
        return nothing;
    }
  }

  private _renderStep(step: DataEntryFlowStep) {
    switch (step.type) {
      case "abort":
        return html`
          ${this.localize("ui.panel.page-authorize.abort_intro")}:
          ${this.localize(
            `ui.panel.page-authorize.form.providers.${step.handler[0]}.abort.${step.reason}`
          )}
        `;
      case "form":
        return html`
          <h1 class="welcome-title">
            ${!["select_mfa_module", "mfa"].includes(step.step_id)
              ? this.localize("ui.panel.page-authorize.welcome_home")
              : this.localize("ui.panel.page-authorize.just_checking")}
          </h1>
          ${this._computeStepDescription(step)
            ? html`<p class="subtitle-text">${this._computeStepDescription(step)}</p>`
            : nothing}
          ${keyed(
            step.step_id,
            html`<ha-auth-form
              .localize=${this.localize}
              .data=${this._stepData!}
              .schema=${autocompleteLoginFields(step.data_schema)}
              .error=${step.errors}
              .disabled=${this._submitting}
              .computeLabel=${this._computeLabelCallback(step)}
              .computeError=${this._computeErrorCallback(step)}
              @value-changed=${this._stepDataChanged}
            ></ha-auth-form>`
          )}

          <div class="space-between">
            ${this.clientId === genClientId() &&
            !["select_mfa_module", "mfa"].includes(step.step_id)
              ? html`
                  <ha-formfield
                    class="store-token"
                    .label=${this.localize(
                      "ui.panel.page-authorize.store_token"
                    )}
                  >
                    <ha-checkbox
                      .checked=${this._storeToken}
                      @change=${this._storeTokenChanged}
                    ></ha-checkbox>
                  </ha-formfield>
                `
              : html`<div></div>`}
            <a
              class="forgot-password"
              href="https://www.home-assistant.io/docs/locked_out/#forgot-password"
              target="_blank"
              rel="noreferrer noopener"
              >${this.localize("ui.panel.page-authorize.forgot_password")}</a
            >
          </div>
        `;
      default:
        return nothing;
    }
  }

  private _storeTokenChanged(e: CustomEvent<HTMLInputElement>) {
    this._storeToken = (e.currentTarget as HTMLInputElement).checked;
  }

  private async _providerChanged(newProvider?: AuthProvider) {
    if (this.step && this.step.type === "form") {
      deleteLoginFlow(this.step.flow_id).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Error delete obsoleted auth flow", err);
      });
    }

    if (newProvider == null) {
      // eslint-disable-next-line no-console
      console.error("No auth provider");
      this._state = "error";
      this._errorMessage = this._unknownError();
      return;
    }

    try {
      const response = await createLoginFlow(this.clientId, this.redirectUri, [
        newProvider.type,
        newProvider.id,
      ]);

      const data = await response.json();

      if (response.ok) {
        // allow auth provider bypass the login form
        if (data.type === "create_entry") {
          redirectWithAuthCode(
            this.redirectUri!,
            data.result,
            this.oauth2State,
            this._storeToken
          );
          return;
        }

        this.step = data;
        this._state = "step";
      } else {
        this._state = "error";
        this._errorMessage = data.message;
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("Error starting auth flow", err);
      this._state = "error";
      this._errorMessage = this._unknownError();
    }
  }

  private _stepDataChanged(ev: CustomEvent) {
    this._stepData = ev.detail.value;
  }

  private _computeStepDescription(step: DataEntryFlowStepForm) {
    const resourceKey =
      `ui.panel.page-authorize.form.providers.${step.handler[0]}.step.${step.step_id}.description` as const;
    return this.localize(resourceKey, step.description_placeholders);
  }

  private _computeLabelCallback(step: DataEntryFlowStepForm) {
    // Returns a callback for ha-form to calculate labels per schema object
    return (schema) =>
      this.localize(
        `ui.panel.page-authorize.form.providers.${step.handler[0]}.step.${step.step_id}.data.${schema.name}`
      );
  }

  private _computeErrorCallback(step: DataEntryFlowStepForm) {
    // Returns a callback for ha-form to calculate error messages
    return (error) =>
      this.localize(
        `ui.panel.page-authorize.form.providers.${step.handler[0]}.error.${error}`
      );
  }

  private _unknownError() {
    return this.localize("ui.panel.page-authorize.form.unknown_error");
  }

  private _startOver() {
    this._providerChanged(this.authProvider);
  }

  private async _handleSubmit(ev: Event) {
    ev.preventDefault();
    if (this.step == null) {
      return;
    }
    if (this.step.type !== "form") {
      this._providerChanged(this.authProvider);
      return;
    }

    if (!this._form?.reportValidity()) {
      return;
    }

    this._submitting = true;

    const postData = { ...this._stepData, client_id: this.clientId };

    try {
      const response = await submitLoginFlow(this.step.flow_id, postData);

      const newStep = await response.json();

      if (response.status === 403) {
        this._state = "error";
        this._errorMessage = newStep.message;
        return;
      }

      if (newStep.type === "create_entry") {
        redirectWithAuthCode(
          this.redirectUri!,
          newStep.result,
          this.oauth2State,
          this._storeToken
        );
        return;
      }
      this.step = newStep;
      this._state = "step";
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("Error submitting step", err);
      this._state = "error";
      this._errorMessage = this._unknownError();
    } finally {
      this._submitting = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-auth-flow": HaAuthFlow;
  }
}
