import "@material/mwc-button";
import { css, CSSResultGroup, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { applyThemesOnElement } from "../common/dom/apply_themes_on_element";
import { fireEvent } from "../common/dom/fire_event";
import { mainWindow } from "../common/dom/get_main_window";
import { extractSearchParamsObject } from "../common/url/search-params";
import "../components/ha-alert";
import "../components/ha-card";
import "../components/ha-checkbox";
import type { HaCheckbox } from "../components/ha-checkbox";
import "../components/ha-formfield";
import "../components/ha-language-picker";
import "../components/ha-svg-icon";
import { domainToName } from "../data/integration";
import { authorizeHomeAssistantConfig, AuthFlow } from "../data/auth";
import { getOptInPromise } from "../data/opt_in";
import { fetchHassioAddonsInfo } from "../data/hassio/addon";
import { makeDialogManager } from "../dialogs/make-dialog-manager";
import { litLocalizeLiteMixin } from "../mixins/lit-localize-lite-mixin";
import { registerServiceWorker } from "../util/register-service-worker";
import { HomeAssistantAuthorize } from "./types";

@customElement("ha-authorize")
export class HaAuthorize extends litLocalizeLiteMixin(LitElement) {
  @property({ attribute: false }) public hass?: HomeAssistantAuthorize;

  @state() private _clientId?: string;

  @state() private _redirectUri?: string;

  @state() private _state?: string;

  @state() private _oauth2State?: string;

  @state() private _flow?: AuthFlow;

  @state() private _stepIndex = 0;

  @state() private _username = "";

  @state() private _password = "";

  @state() private _rememberLogin = true;

  @state() private _error?: string;

  @state() private _submitting = false;

  protected firstUpdated(changedProps) {
    super.firstUpdated(changedProps);
    this._init();
  }

  private async _init() {
    const params = extractSearchParamsObject();
    this._clientId = params.client_id;
    this._redirectUri = params.redirect_uri;
    this._state = params.state;
    this._oauth2State = params.oauth2_state;

    if (!this._clientId || !this._redirectUri) {
      return;
    }

    try {
      const flows = await authorizeHomeAssistantConfig(
        this.hass!,
        this._clientId,
        this._redirectUri
      );
      this._flow = flows.flows[0];
    } catch (err: any) {
      this._error = err.message;
    }
  }

  protected render() {
    if (this._error) {
      return html`
        <div class="container">
          <ha-alert alert-type="error">${this._error}</ha-alert>
        </div>
      `;
    }

    if (!this._flow) {
      return html`<div class="container"><p>Loading...</p></div>`;
    }

    const step = this._flow.steps[this._stepIndex];

    return html`
      <div class="container">
        <!-- 顶部标题 -->
        <div class="page-header">
          <h1 class="page-title">智能云平台登录</h1>
        </div>

        <!-- 主内容区域 -->
        <div class="main-content">
          <!-- 左侧科技图片区域 -->
          <div class="left-section">
            <div class="tech-illustration">
              <!-- SVG 智慧城市插图 -->
              <svg viewBox="0 0 800 600" class="city-svg">
                <defs>
                  <linearGradient id="buildingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:#007bff;stop-opacity:0.3" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                <!-- 城市建筑轮廓 -->
                <g class="buildings">
                  <rect x="100" y="350" width="60" height="200" fill="url(#buildingGrad)" opacity="0.6"/>
                  <rect x="180" y="300" width="70" height="250" fill="url(#buildingGrad)" opacity="0.7"/>
                  <rect x="270" y="280" width="80" height="270" fill="url(#buildingGrad)" opacity="0.8"/>
                  <rect x="370" y="320" width="65" height="230" fill="url(#buildingGrad)" opacity="0.7"/>
                  <rect x="455" y="260" width="90" height="290" fill="url(#buildingGrad)" opacity="0.9"/>
                  <rect x="565" y="340" width="75" height="210" fill="url(#buildingGrad)" opacity="0.6"/>
                  <rect x="660" y="310" width="85" height="240" fill="url(#buildingGrad)" opacity="0.7"/>
                </g>
                
                <!-- 建筑窗户灯光 -->
                <g class="windows">
                  ${Array.from({length: 30}, (_, i) => {
                    const x = 110 + Math.random() * 620;
                    const y = 280 + Math.random() * 250;
                    return html`<circle cx="${x}" cy="${y}" r="2" fill="#00ffff" opacity="0.8" filter="url(#glow)"/>`;
                  })}
                </g>
                
                <!-- 浮动图标 -->
                <g class="floating-icons" filter="url(#glow)">
                  <!-- WiFi 图标 -->
                  <circle cx="200" cy="180" r="35" fill="rgba(0, 212, 255, 0.2)" stroke="#00d4ff" stroke-width="2"/>
                  <path d="M185 180 Q200 165 215 180 M190 185 Q200 175 210 185 M195 190 Q200 185 205 190" 
                        stroke="#00d4ff" stroke-width="3" fill="none"/>
                  
                  <!-- 监控摄像头图标 -->
                  <circle cx="320" cy="150" r="35" fill="rgba(0, 212, 255, 0.2)" stroke="#00d4ff" stroke-width="2"/>
                  <path d="M310 150 L315 145 L325 145 L330 150 L325 155 L315 155 Z" 
                        stroke="#00d4ff" stroke-width="2" fill="none"/>
                  <circle cx="320" cy="150" r="3" fill="#00d4ff"/>
                  
                  <!-- 电脑图标 -->
                  <circle cx="450" cy="160" r="35" fill="rgba(0, 212, 255, 0.2)" stroke="#00d4ff" stroke-width="2"/>
                  <rect x="440" y="150" width="20" height="15" stroke="#00d4ff" stroke-width="2" fill="none" rx="2"/>
                  <line x1="445" y1="165" x2="455" y2="165" stroke="#00d4ff" stroke-width="2"/>
                  <line x1="450" y1="165" x2="450" y2="170" stroke="#00d4ff" stroke-width="2"/>
                  
                  <!-- 路灯图标 -->
                  <circle cx="580" cy="170" r="35" fill="rgba(0, 212, 255, 0.2)" stroke="#00d4ff" stroke-width="2"/>
                  <line x1="580" y1="155" x2="580" y2="175" stroke="#00d4ff" stroke-width="2"/>
                  <path d="M575 155 Q580 150 585 155" stroke="#00d4ff" stroke-width="2" fill="none"/>
                  <circle cx="580" cy="155" r="3" fill="#00ffff"/>
                  
                  <!-- 对勾图标 -->
                  <circle cx="380" cy="130" r="35" fill="rgba(0, 212, 255, 0.2)" stroke="#00d4ff" stroke-width="2"/>
                  <path d="M370 130 L378 138 L392 122" stroke="#00d4ff" stroke-width="3" fill="none" stroke-linecap="round"/>
                </g>
                
                <!-- 连接线 -->
                <g class="connections" stroke="#00d4ff" stroke-width="1" opacity="0.4">
                  <line x1="200" y1="215" x2="200" y2="350" stroke-dasharray="5,5"/>
                  <line x1="320" y1="185" x2="270" y2="280" stroke-dasharray="5,5"/>
                  <line x1="450" y1="195" x2="370" y2="320" stroke-dasharray="5,5"/>
                  <line x1="580" y1="205" x2="565" y2="340" stroke-dasharray="5,5"/>
                  <line x1="380" y1="165" x2="455" y2="260" stroke-dasharray="5,5"/>
                </g>
                
                <!-- 底部平台 -->
                <ellipse cx="400" cy="560" rx="350" ry="30" fill="rgba(0, 212, 255, 0.1)" stroke="#00d4ff" stroke-width="1" opacity="0.5"/>
                <ellipse cx="400" cy="570" rx="320" ry="25" fill="rgba(0, 212, 255, 0.08)" stroke="#00d4ff" stroke-width="1" opacity="0.4"/>
                <ellipse cx="400" cy="580" rx="290" ry="20" fill="rgba(0, 212, 255, 0.05)" stroke="#00d4ff" stroke-width="1" opacity="0.3"/>
                
                <!-- 中心光效 -->
                <circle cx="400" cy="560" r="15" fill="#00ffff" opacity="0.8" filter="url(#glow)"/>
                <circle cx="400" cy="560" r="25" fill="#00d4ff" opacity="0.4" filter="url(#glow)"/>
              </svg>
            </div>
          </div>

          <!-- 右侧登录表单 -->
          <div class="right-section">
            <div class="login-card">
              <div class="card-header">
                <h2 class="login-title">用户登录</h2>
                <div class="title-underline"></div>
              </div>
              
              <div class="card-content">
                ${step.step === "username_password"
                  ? html`
                      <div class="input-group">
                        <ha-svg-icon class="input-icon" .path=${"M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"}></ha-svg-icon>
                        <input
                          class="text-input"
                          type="text"
                          placeholder="请输入用户名"
                          .value=${this._username}
                          @input=${this._handleUsernameInput}
                          autocomplete="username"
                          required
                        />
                      </div>

                      <div class="input-group">
                        <ha-svg-icon class="input-icon" .path=${"M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"}></ha-svg-icon>
                        <input
                          class="text-input"
                          type="password"
                          placeholder="请输入密码"
                          .value=${this._password}
                          @input=${this._handlePasswordInput}
                          autocomplete="current-password"
                          required
                        />
                      </div>

                      <div class="options-row">
                        <label class="checkbox-label">
                          <input
                            type="checkbox"
                            .checked=${this._rememberLogin}
                            @change=${this._handleRememberChange}
                          />
                          <span>记住密码</span>
                        </label>
                        <a href="#" class="forgot-link">忘记密码</a>
                      </div>

                      <button
                        class="login-button"
                        @click=${this._handleSubmit}
                        ?disabled=${this._submitting}
                      >
                        ${this._submitting ? "登录中..." : "登录"}
                      </button>
                    `
                  : nothing}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _handleUsernameInput(ev) {
    this._username = ev.target.value;
  }

  private _handlePasswordInput(ev) {
    this._password = ev.target.value;
  }

  private _handleRememberChange(ev) {
    this._rememberLogin = ev.target.checked;
  }

  private async _handleSubmit() {
    if (!this._username || !this._password) {
      this._error = "请填写所有字段";
      return;
    }

    this._submitting = true;
    this._error = undefined;

    try {
      // 这里调用实际的登录 API
      console.log("Logging in with:", this._username, this._password);
      
      // 模拟登录成功
      setTimeout(() => {
        this._submitting = false;
        // 重定向到主页
        window.location.href = "/";
      }, 1000);
    } catch (err: any) {
      this._error = err.message;
      this._submitting = false;
    }
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      /* ========== 整体容器 - 深蓝色纯色背景 ========== */
      .container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: #0a1929;
        position: relative;
        overflow: hidden;
      }

      /* ========== 顶部标题 ========== */
      .page-header {
        text-align: center;
        padding: 40px 20px 20px;
        z-index: 10;
      }

      .page-title {
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        letter-spacing: 3px;
        text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
      }

      /* ========== 主内容区域 ========== */
      .main-content {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: 60px;
        padding: 40px 80px;
        max-width: 1400px;
        margin: 0 auto;
        width: 100%;
      }

      /* ========== 左侧科技图片区域 ========== */
      .left-section {
        flex: 1.2;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .tech-illustration {
        width: 100%;
        max-width: 700px;
        animation: floatIllustration 6s ease-in-out infinite;
      }

      @keyframes floatIllustration {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }

      .city-svg {
        width: 100%;
        height: auto;
        filter: drop-shadow(0 0 30px rgba(0, 212, 255, 0.3));
      }

      /* ========== 右侧登录卡片 ========== */
      .right-section {
        flex: 0.8;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .login-card {
        width: 100%;
        max-width: 380px;
        background: rgba(10, 25, 41, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(0, 150, 255, 0.3);
        border-radius: 8px;
        padding: 40px 35px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                    0 0 40px rgba(0, 150, 255, 0.1);
        position: relative;
        overflow: hidden;
      }

      /* 卡片顶部光效 */
      .login-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, transparent, #00d4ff, transparent);
        animation: shimmer 3s infinite;
      }

      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }

      /* 卡片标题 */
      .card-header {
        text-align: center;
        margin-bottom: 35px;
      }

      .login-title {
        font-size: 24px;
        font-weight: 600;
        color: #00d4ff;
        margin: 0 0 15px 0;
        letter-spacing: 2px;
      }

      .title-underline {
        width: 100px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #00d4ff, transparent);
        margin: 0 auto;
      }

      /* 输入框组 */
      .input-group {
        position: relative;
        margin-bottom: 25px;
      }

      .input-icon {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        fill: rgba(0, 212, 255, 0.6);
        z-index: 1;
      }

      .text-input {
        width: 100%;
        padding: 12px 0 12px 35px;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        font-size: 15px;
        outline: none;
        transition: all 0.3s ease;
      }

      .text-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }

      .text-input:focus {
        border-bottom-color: #00d4ff;
      }

      .text-input:focus ~ .input-icon,
      .input-group:focus-within .input-icon {
        fill: #00d4ff;
      }

      /* 选项行 */
      .options-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        margin-top: 10px;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        user-select: none;
      }

      .checkbox-label input[type="checkbox"] {
        width: 16px;
        height: 16px;
        margin-right: 8px;
        cursor: pointer;
        accent-color: #00d4ff;
      }

      .checkbox-label span {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      .forgot-link {
        color: #00d4ff;
        text-decoration: none;
        font-size: 14px;
        transition: all 0.3s ease;
      }

      .forgot-link:hover {
        color: #00ffff;
        text-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
      }

      /* 登录按钮 */
      .login-button {
        width: 100%;
        height: 45px;
        background: linear-gradient(135deg, #007bff 0%, #00d4ff 100%);
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 2px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
      }

      .login-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.5);
        background: linear-gradient(135deg, #0088ff 0%, #00e4ff 100%);
      }

      .login-button:active:not(:disabled) {
        transform: translateY(0);
      }

      .login-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* 响应式设计 */
      @media (max-width: 1024px) {
        .main-content {
          flex-direction: column;
          gap: 40px;
          padding: 20px 40px;
        }

        .left-section {
          order: 2;
        }

        .right-section {
          order: 1;
        }

        .tech-illustration {
          max-width: 500px;
        }
      }

      @media (max-width: 768px) {
        .page-title {
          font-size: 24px;
        }

        .main-content {
          padding: 20px;
        }

        .login-card {
          padding: 30px 25px;
        }

        .login-title {
          font-size: 22px;
        }

        .tech-illustration {
          max-width: 400px;
        }
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-authorize": HaAuthorize;
  }
}
