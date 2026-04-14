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
      :host {
        display: flex;
        flex-direction: row; /* 强制水平排列 */
        height: 100vh;
        width: 100vw;
        background-color: var(--primary-background-color);
        overflow: hidden;
      }

      .promo-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #0096c7 0%, #f0a500 100%);
        color: white;
        padding: 40px;
        text-align: center;
      }

      .promo-section h1 {
        font-size: 3em;
        margin-bottom: 20px;
        font-weight: bold;
      }

      .promo-section p {
        font-size: 1.2em;
        opacity: 0.9;
      }

      .login-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 40px;
        background-color: var(--primary-background-color);
      }

      .login-container {
        width: 100%;
        max-width: 400px;
        padding: 30px;
        background-color: var(--card-background-color);
        border-radius: var(--ha-card-border-radius, 8px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,0.1));
      }

      /* 隐藏原有的顶部 Logo，因为左侧已经有宣传语了，或者你可以选择保留 */
      .header {
        display: none; 
      }

      @media (max-width: 768px) {
        :host {
          flex-direction: column;
        }
        .promo-section {
          padding: 20px;
          min-height: 200px;
        }
        .promo-section h1 {
          font-size: 2em;
        }
      }
    </style>

    <div class="promo-section">
      <h1>欢迎回家</h1>
      <p>智能 · 便捷 · 安全<br>掌控你的每一个生活细节</p>
    </div>

    <div class="login-section">
      <div class="login-container">
        <div class="header">
          <img src="/static/icons/favicon-apple-180x180.png" alt="Home Assistant" />
        </div>
        
        <ha-auth-form
          .hass="${this.hass}"
          .oauth2State="${this.oauth2State}"
          .clientId="${this.clientId}"
          .redirectUri="${this.redirectUri}"
          .state="${this.state}"
          .scope="${this.scope}"
          .responseType="${this.responseType}"
          .codeChallenge="${this.codeChallenge}"
          .codeChallengeMethod="${this.codeChallengeMethod}"
          .prompt="${this.prompt}"
          .loginFlow="${this.loginFlow}"
          .step="${this.step}"
          .error="${this.error}"
          @ha-auth-step-changed="${this._handleStepChanged}"
        ></ha-auth-form>

        <div class="footer-links">
          <a href="/?external_auth=1">${this.localize("ui.auth.authorize.external_return")}</a>
        </div>
      </div>
    </div>
`;
    }

    const inactiveProviders = this._authProviders?.filter(
      (prv) => prv !== this._authProvider
    );

    const app = this.clientId && this.clientId in appNames;

    return html`
      <style>
        /* 1. 设置整个页面的布局为 Flexbox */
        :host {
          display: flex;
          height: 100vh;
          width: 100vw;
          background-color: var(--primary-background-color);
        }

        /* 2. 左侧宣传区域 */
        .promo-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 40px;
          background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
          color: white;
          text-align: center;
        }
        .promo-title {
          font-size: 3rem;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .promo-text {
          font-size: 1.2rem;
          opacity: 0.9;
        }

        /* 3. 右侧登录区域 */
        .login-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        /* 保持原有的卡片样式 */
        .card-content {
          background: var(--ha-card-background, var(--card-background-color, white));
          box-shadow: var(--ha-card-box-shadow, none);
          border-radius: var(--ha-card-border-radius, 12px);
          border: 1px solid var(--divider-color);
          padding: 24px;
          width: 100%;
          max-width: 400px;
        }
        
        /* 隐藏原有的全屏背景警告，使其融入卡片 */
        ha-alert {
          margin-bottom: 16px;
        }
      </style>

      <!-- 左侧：宣传标语 -->
      <div class="promo-section">
        <div class="promo-title">欢迎回家</div>
        <div class="promo-text">智能 · 便捷 · 安全<br>掌控你的每一个生活细节</div>
      </div>

      <!-- 右侧：登录界面 -->
      <div class="login-section">
        ${!this._ownInstance
          ? html`<ha-alert .alertType=${app ? "info" : "warning"}>
              ${app
                ? this.localize("ui.panel.page-authorize.authorizing_app", {
                    app: appNames[this.clientId!],
                  })
                : this.localize("ui.panel.page-authorize.authorizing_client", {
                    clientId: html`<b>${this.clientId ? punycode.toASCII(this.clientId) : this.clientId}</b>`,
                  })}
            </ha-alert>`
          : nothing}

        <div class="card-content">
          ${!this._authProvider
            ? html`<p>${this.localize("ui.panel.page-authorize.initializing")}</p>`
            : html`<ha-auth-flow
                  .clientId=${this.clientId}
                  .redirectUri=${this.redirectUri}
                  .oauth2State=${this.oauth2State}
                  .authProvider=${this._authProvider}
                  .localize=${this.localize}
                  .initStoreToken=${this._preselectStoreToken}
                ></ha-auth-flow>
                ${inactiveProviders!.length > 0
                  ? html`<ha-pick-auth-provider
                      .localize=${this.localize}
                      .clientId=${this.clientId}
                      .authProviders=${inactiveProviders!}
                      @pick-auth-provider=${this._handleAuthProviderPick}
                    ></ha-pick-auth-provider>`
                  : ""}`}
        </div>
        
        <div class="footer" style="width: 100%; max-width: 400px; margin-top: 16px;">
          <!-- 底部语言选择和帮助链接保持不变 -->
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
