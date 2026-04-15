/* eslint-disable lit/prefer-static-styles */
import { mdiOpenInNew } from "@mdi/js";
import type { PropertyValues } from "lit";
import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import punycode from "punycode";
import { applyThemesOnElement } from "../common/dom/apply_themes_on_element";
import { extractSearchParamsObject } from "../common/url/search-params";
import "../components/ha-alert";
import "../components/ha-button";
import "../components/ha-svg-icon";
import type { AuthProvider, AuthUrlSearchParams } from "../data/auth";
import { fetchAuthProviders } from "../data/auth";
import { litLocalizeLiteMixin } from "../mixins/lit-localize-lite-mixin";
import { registerServiceWorker } from "../util/register-service-worker";
import "./ha-auth-flow";

import("./ha-pick-auth-provider");

const appNames = {
  "https://home-assistant.io/iOS": "iOS",
  "https://home-assistant.io/android": "Android",
};

@customElement("ha-authorize")
export class HaAuthorize extends litLocalizeLiteMixin(LitElement) {
  @property({ attribute: false }) public clientId?: string;

  @property({ attribute: false }) public redirectUri?: string;

  @property({ attribute: false }) public oauth2State?: string;

  @property({ attribute: false }) public translationFragment = "page-authorize";

  @state() private _authProvider?: AuthProvider;

  @state() private _authProviders?: AuthProvider[];

  @state() private _preselectStoreToken = false;

  @state() private _ownInstance = false;

  @state() private _error?: string;

  constructor() {
    super();
    const query = extractSearchParamsObject() as AuthUrlSearchParams;
    if (query.client_id) {
      this.clientId = query.client_id;
    }
    if (query.redirect_uri) {
      this.redirectUri = query.redirect_uri;
    }
    if (query.state) {
      this.oauth2State = query.state;
    }
  }

  protected render() {
    if (this._error) {
      return html`
        <style>
          ha-authorize ha-alert {
            display: block;
            margin: 16px 0;
            background-color: var(--primary-background-color, #fafafa);
          }
        </style>
        <ha-alert alert-type="error"
          >${this._error} ${this.redirectUri}</ha-alert
        >
      `;
    }

    const inactiveProviders = this._authProviders?.filter(
      (prv) => prv !== this._authProvider
    );

    const app = this.clientId && this.clientId in appNames;

    return html`
      <style>
        :host {
          display: block;
          height: 100vh;
          overflow: hidden;
        }
        .split-layout {
          display: flex;
          height: 100%;
          width: 100%;
        }
        /* --- 左侧宣传区 --- */
        .promo-side {
          flex: 1;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .promo-content {
          z-index: 2;
          text-align: center;
          padding: 24px;
        }
        .promo-content h1 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 1rem;
          letter-spacing: 2px;
          text-shadow: 0 0 20px rgba(66, 153, 225, 0.6);
        }
        .promo-content p {
          font-size: 1.2rem;
          opacity: 0.8;
        }
        .tech-circle {
          width: 200px;
          height: 200px;
          border: 2px solid rgba(66, 153, 225, 0.3);
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 4s infinite;
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.95); box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.7); }
          70% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 50px rgba(66, 153, 225, 0); }
          100% { transform: translate(-50%, -50%) scale(0.95); box-shadow: 0 0 0 0 rgba(66, 153, 225, 0); }
        }
        /* --- 右侧登录区 --- */
        .login-side {
          flex: 1;
          background-color: var(--ha-color-surface-default, #f5f5f5);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 24px;
          position: relative;
        }
        .card-content {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: var(--ha-border-radius-lg, 16px);
          padding: 40px 32px 32px 32px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 10px 40px 0 rgba(31, 38, 135, 0.12);
        }
        @media (prefers-color-scheme: dark) {
          .card-content {
            background: rgba(30, 41, 59, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: white;
          }
          .login-side {
            background-color: #0f172a;
          }
        }
        ha-auth-flow {
          display: flex;
          justify-content: center;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
        ha-pick-auth-provider {
          display: block;
          margin-top: 24px;
          width: 100%;
        }
        ha-alert {
          display: block;
          margin: 16px 0;
          background-color: var(--primary-background-color, #fafafa);
        }
        p {
          font-size: var(--ha-font-size-m);
          line-height: var(--ha-line-height-normal);
        }
        .footer {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 420px;
          font-size: 0.9rem;
        }
        .footer ha-svg-icon {
          --mdc-icon-size: var(--ha-space-5);
        }
        h1 {
          font-size: var(--ha-font-size-3xl);
          font-weight: var(--ha-font-weight-normal);
          margin-top: 16px;
          margin-bottom: 16px;
          text-align: center;
        }
        @media (max-width: 768px) {
          .promo-side {
            display: none;
          }
          .login-side {
            flex: 1;
          }
          .card-content {
            padding: 32px 24px 24px 24px;
            max-width: 100%;
          }
        }
      </style>

      <div class="split-layout">
        <!-- 左侧：宣传与动画区 -->
        <div class="promo-side">
          <div class="promo-content">
            <h1>XOAI Home</h1>
            <p>智控未来 · 极简生活</p>
            <div class="tech-circle"></div>
          </div>
        </div>

        <!-- 右侧：登录操作区 -->
        <div class="login-side">
          ${!this._ownInstance
            ? html`<ha-alert .alertType=${app ? "info" : "warning"} style="width: 100%; max-width: 420px;">
                ${app
                  ? this.localize("ui.panel.page-authorize.authorizing_app", {
                      app: appNames[this.clientId!],
                    })
                  : this.localize("ui.panel.page-authorize.authorizing_client", {
                      clientId: html`<b
                        >${this.clientId
                          ? punycode.toASCII(this.clientId)
                          : this.clientId}</b
                      >`,
                    })}
              </ha-alert>`
            : nothing}

          <div class="card-content">
            ${!this._authProvider
              ? html`<p>
                  ${this.localize("ui.panel.page-authorize.initializing")}
                </p> `
              : html`<ha-auth-flow
                    .clientId=${this.clientId}
                    .redirectUri=${this.redirectUri}
                    .oauth2State=${this.oauth2State}
                    .authProvider=${this._authProvider}
                    .localize=${this.localize}
                    .initStoreToken=${this._preselectStoreToken}
                  ></ha-auth-flow>
                  ${inactiveProviders!.length > 0
                    ? html`
                        <ha-pick-auth-provider
                          .localize=${this.localize}
                          .clientId=${this.clientId}
                          .authProviders=${inactiveProviders!}
                          @pick-auth-provider=${this._handleAuthProviderPick}
                        ></ha-pick-auth-provider>
                      `
                    : ""}`}
          </div>
          <div class="footer">
            <ha-language-picker
              .value=${this.language}
              .label=${""}
              button-style
              native-name
              @value-changed=${this._languageChanged}
            ></ha-language-picker>
            <ha-button
              appearance="plain"
              variant="neutral"
              href="https://www.home-assistant.io/docs/authentication/"
              target="_blank"
              rel="noreferrer noopener"
            >
              ${this.localize("ui.panel.page-authorize.help")}
              <ha-svg-icon slot="end" .path=${mdiOpenInNew}></ha-svg-icon>
            </ha-button>
          </div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }

  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);

    if (!this.redirectUri) {
      this._error = "Invalid redirect URI";
      return;
    }

    let url: URL;

    try {
      url = new URL(this.redirectUri);
    } catch (_err) {
      this._error = "Invalid redirect URI";
      return;
    }

    if (
      // eslint-disable-next-line no-script-url
      ["javascript:", "data:", "vbscript:", "file:", "about:"].includes(
        url.protocol
      )
    ) {
      this._error = "Invalid redirect URI";
      return;
    }

    this._fetchAuthProviders();

    if (matchMedia("(prefers-color-scheme: dark)").matches) {
      applyThemesOnElement(
        document.documentElement,
        {
          default_theme: "default",
          default_dark_theme: null,
          themes: {},
          darkMode: true,
          theme: "default",
        },
        undefined,
        undefined,
        true
      );
    }

    if (
      window.innerWidth > 450 &&
      !matchMedia("(prefers-reduced-motion)").matches
    ) {
      import("../resources/particles");
    }

    // If we are logging into the instance that is hosting this auth form
    // we will register the service worker to start preloading.
    if (url.host === location.host) {
      this._ownInstance = true;
      registerServiceWorker(this, false);
    }

    import("../components/ha-language-picker");
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);
    if (changedProps.has("language")) {
      document.querySelector("html")!.setAttribute("lang", this.language!);
    }
  }

  private async _fetchAuthProviders() {
    // Fetch auth providers
    try {
      // We prefetch this data on page load in authorize.html.template for modern builds
      const response = await ((window as any).providersPromise ||
        fetchAuthProviders());
      const authProviders = await response.json();

      // Forward to main screen which will redirect to right onboarding page.
      if (
        response.status === 400 &&
        authProviders.code === "onboarding_required"
      ) {
        location.href = `/onboarding.html${location.search}`;
        return;
      }

      if (authProviders.providers.length === 0) {
        this._error = "No auth providers returned. Unable to finish login.";
        return;
      }

      this._authProviders = authProviders.providers;
      this._authProvider = authProviders.providers[0];
      this._preselectStoreToken = authProviders.preselect_remember_me;
    } catch (err: any) {
      this._error = "Unable to fetch auth providers.";
      // eslint-disable-next-line
      console.error("Error loading auth providers", err);
    }
  }

  private async _handleAuthProviderPick(ev) {
    this._authProvider = ev.detail;
  }

  private _languageChanged(ev: CustomEvent) {
    const language = ev.detail.value;
    this.language = language;

    try {
      window.localStorage.setItem("selectedLanguage", JSON.stringify(language));
    } catch (_err: any) {
      // Ignore
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-authorize": HaAuthorize;
  }
}
