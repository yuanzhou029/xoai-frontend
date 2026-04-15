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

// ═══════════════════════════════════════════════════════
// 【标注】已知应用的映射表 —— 用于在授权提示中显示友好名称
// 当 client_id 匹配这些 URL 时，页面会显示 "正在授权 iOS/Android 应用"
// 而不是显示原始的 client_id
// ═══════════════════════════════════════════════════════
const appNames = {
  "https://home-assistant.io/iOS": "iOS",
  "https://home-assistant.io/android": "Android",
};

// ═══════════════════════════════════════════════════════
// 【标注】共享样式 —— 深色主题的全局 CSS
// 包含：
//   1. 整体渐变背景 (#0a0f1c → #111827 → #1a2236)
//   2. CSS 自定义属性（表单背景色、边框色、文字色等）
//   3. 左右分栏布局 (.split-layout + 网格纹理)
//   4. 左侧宣传区样式 (呼吸灯动画、品牌标签)
//   5. 右侧登录区样式 (毛玻璃卡片、顶部光条)
//   6. 响应式适配 (≤768px 隐藏左侧)
// ═══════════════════════════════════════════════════════
const sharedStyles = html`
  <style>
    /* 【修改】将渐变背景应用到 html 和 body，确保在 Light DOM 下生效 */
    html, body {
      margin: 0;
      padding: 0;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: linear-gradient(135deg, #0a0f1c 0%, #111827 25%, #1a2236 50%, #111827 75%, #0a0f1c 100%);
    }

    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }

    /* 【标注】深色主题表单 CSS 变量 —— 统一控制所有子组件的颜色 */
    ha-authorize {
      --ha-color-form-background: rgba(255, 255, 255, 0.08);
      --ha-color-form-background-hover: rgba(255, 255, 255, 0.12);
      --ha-color-form-background-disabled: rgba(255, 255, 255, 0.04);
      --ha-color-border-neutral-quiet: rgba(255, 255, 255, 0.15);
      --ha-color-border-neutral-loud: rgba(255, 255, 255, 0.25);
      --ha-color-text-secondary: #94a3b8;
      --ha-color-neutral-60: #64748b;
      --secondary-text-color: #94a3b8;
      --card-background-color: rgba(255, 255, 255, 0.08);
      --ha-color-fill-danger-loud-resting: #ef4444;
      --ha-color-on-danger-quiet: #f87171;
      --primary-color: #60a5fa;
      width: 100vw;
      min-width: 100vw;
    }

    .split-layout {
      display: flex;
      height: 100%;
      width: 100%;
      position: relative;
    }

    /* 【标注】网格背景纹理 —— 50x50 的半透明网格叠加 */
    .split-layout::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      pointer-events: none;
      z-index: 0;
    }

    /* 【标注】左侧宣传区 —— 占 50% 宽度，品牌展示 + 动画 */
    .promo-side {
      flex: 0 0 50%;
      width: 50%;
      min-width: 50%;
      background: transparent;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
      padding: 40px;
      z-index: 1;
    }

    .promo-content {
      z-index: 2;
      text-align: center;
      max-width: 500px;
      width: 100%;
      position: relative;
    }

    /* 【标注】呼吸灯容器 —— 包裹品牌文字，280x280 */
    .tech-circle-wrapper {
      position: relative;
      width: 280px;
      height: 280px;
      margin: 0 auto 3rem auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* 【标注】外圈呼吸灯 —— 蓝色边框 + pulse 动画 */
    .tech-circle {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid rgba(96, 165, 250, 0.3);
      animation: pulse 4s ease-in-out infinite;
      box-sizing: border-box;
    }

    /* 【标注】内圈呼吸灯 —— 延迟 1s 启动，紫色边框 */
    .tech-circle::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 75%;
      height: 75%;
      border: 1px solid rgba(167, 139, 250, 0.25);
      border-radius: 50%;
      animation: pulse 4s ease-in-out infinite 1s;
    }

    /* 【标注】第三圈呼吸灯 —— 延迟 2s 启动，更淡的蓝色 */
    .tech-circle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50%;
      height: 50%;
      border: 1px solid rgba(96, 165, 250, 0.15);
      border-radius: 50%;
      animation: pulse 4s ease-in-out infinite 2s;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(0.95);
        opacity: 0.6;
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.2);
      }
      50% {
        transform: scale(1.02);
        opacity: 1;
        box-shadow: 0 0 60px rgba(96, 165, 250, 0.4), 0 0 100px rgba(167, 139, 250, 0.2);
      }
    }

    /* 【标注】中心品牌文字 —— 渐变色动画标题 + 副标题 */
    .circle-content {
      position: relative;
      z-index: 10;
      text-align: center;
    }

    .circle-content h1 {
      font-size: 2.8rem;
      font-weight: 800;
      margin: 0 0 0.5rem 0;
      letter-spacing: 3px;
      background: linear-gradient(135deg, #60a5fa, #a78bfa, #60a5fa);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient 3s ease infinite;
      text-shadow: none;
    }

    @keyframes gradient {
      0% { background-position: 0% center; }
      50% { background-position: 100% center; }
      100% { background-position: 0% center; }
    }

    .circle-content .subtitle {
      font-size: 1.2rem;
      color: #94a3b8;
      font-weight: 300;
      letter-spacing: 2px;
      margin: 0;
    }

    /* 【标注】广告/介绍区域 —— 智慧生活介绍 + 功能标签 */
    .ad-section {
      margin-top: 0;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .ad-section .ad-title {
      font-size: 1.1rem;
      color: #60a5fa;
      margin-bottom: 1.2rem;  /* 【优化】从 1rem 增加到 1.2rem，增加标题与副标题间距 */
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .ad-section .ad-text {
      font-size: 0.9rem;
      color: #64748b;
      line-height: 1.7;
      margin-bottom: 1.5rem;
    }

    .ad-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .ad-tag {
      padding: 6px 14px;
      background: rgba(96, 165, 250, 0.1);
      border: 1px solid rgba(96, 165, 250, 0.2);
      border-radius: 20px;
      font-size: 0.8rem;
      color: #93c5fd;
      transition: all 0.3s ease;
    }

    .ad-tag:hover {
      background: rgba(96, 165, 250, 0.2);
      border-color: rgba(96, 165, 250, 0.4);
    }

    /* 【标注】右侧登录区 —— 占 50% 宽度，垂直居中 */
    .login-side {
      flex: 0 0 50%;
      width: 50%;
      min-width: 50%;
      background: transparent;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 24px 40px;
      position: relative;
      z-index: 1;
    }

    /* 【标注】登录卡片 —— 毛玻璃效果 + 顶部蓝色光条 */
    .card-content {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 48px 40px 40px 40px;
      width: 100%;
      max-width: 440px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      position: relative;
      overflow: hidden;
    }

    /* 【标注】卡片顶部渐变光条装饰 */
    .card-content::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.6), transparent);
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
      background-color: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
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
      max-width: 440px;
      font-size: 0.9rem;
    }

    /* 【优化】底部链接和按钮颜色为浅蓝色，增强可点击性 */
    .footer ha-button {
      --ha-color-button-text: #60a5fa;
      color: #60a5fa;
    }

    .footer ha-language-picker {
      --ha-color-button-text: #60a5fa;
      color: #60a5fa;
    }

    .footer ha-svg-icon {
      --mdc-icon-size: var(--ha-space-5);
      color: #60a5fa;
    }

    h1 {
      font-size: var(--ha-font-size-3xl);
      font-weight: var(--ha-font-weight-normal);
      margin-top: 16px;
      margin-bottom: 16px;
      text-align: center;
    }

    /* 【标注】响应式 —— 小屏隐藏左侧宣传区，登录区占满 */
    @media (max-width: 768px) {
      .promo-side {
        display: none;
      }
      .login-side {
        flex: 0 0 100%;
        width: 100%;
        min-width: 100%;
      }
      .card-content {
        padding: 32px 24px 24px 24px;
        max-width: 100%;
      }
    }
  </style>
`;

// ═══════════════════════════════════════════════════════
// 【标注】HaAuthorize —— 授权页面根组件
// 职责：
//   1. 从 URL 查询参数获取 client_id、redirect_uri、state（OAuth2 标准参数）
//   2. 获取可用的认证提供者列表（用户名密码、MFA等）
//   3. 渲染左右分栏页面：左侧品牌展示，右侧登录卡片
//   4. 将认证提供者传递给 ha-auth-flow 子组件执行登录流程
//   5. 处理语言切换、深色主题、Service Worker 注册
// ═══════════════════════════════════════════════════════
@customElement("ha-authorize")
export class HaAuthorize extends litLocalizeLiteMixin(LitElement) {
  /** 【标注】OAuth2 客户端ID —— 标识哪个应用在请求授权 */
  @property({ attribute: false }) public clientId?: string;

  /** 【标注】OAuth2 回调地址 —— 登录成功后跳转到此URL并携带 auth code */
  @property({ attribute: false }) public redirectUri?: string;

  /** 【标注】OAuth2 state 参数 —— 用于 CSRF 防护，回调时原样返回 */
  @property({ attribute: false }) public oauth2State?: string;

  /** 【标注】国际化翻译片段 key，用于加载对应的语言文件 */
  @property({ attribute: false }) public translationFragment = "page-authorize";

  /** 【标注】当前选中的认证提供者（如 "homeassistant" 用户名密码登录） */
  @state() private _authProvider?: AuthProvider;

  /** 【标注】所有可用的认证提供者列表 */
  @state() private _authProviders?: AuthProvider[];

  /** 【标注】是否预选中"记住我"复选框 */
  @state() private _preselectStoreToken = false;

  /** 【标注】是否为本实例登录（用于决定是否注册 Service Worker 预加载） */
  @state() private _ownInstance = false;

  /** 【标注】全局错误信息 */
  @state() private _error?: string;

  constructor() {
    super();
    // 【标注】构造函数中解析 URL 查询参数，填充 OAuth2 相关属性
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

  // ═══════════════════════════════════════════════════════
  // 【标注】render —— 主渲染函数
  // 渲染结构：
  //   错误态 → ha-alert 错误提示
  //   正常态 → split-layout (左右分栏)
  //     ├── promo-side (左侧): XOAI Home 品牌 + 呼吸灯动画 + 功能标签
  //     └── login-side (右侧): 授权提示 + 毛玻璃登录卡片 + 底部语言切换/帮助
  // ═══════════════════════════════════════════════════════
  protected render() {
    if (this._error) {
      return html`
        ${sharedStyles}
        <ha-alert alert-type="error"
          >${this._error} ${this.redirectUri}</ha-alert
        >
      `;
    }

    // 【标注】过滤出未被选中的认证提供者，用于底部的切换列表
    const inactiveProviders = this._authProviders?.filter(
      (prv) => prv !== this._authProvider
    );

    // 【标注】判断是否为已知官方 App（iOS/Android）
    const app = this.clientId && this.clientId in appNames;

    return html`
      ${sharedStyles}

      <div class="split-layout">
        <!-- 【标注】左侧：品牌宣传与动画区 -->
        <div class="promo-side">
          <div class="promo-content">
            <!-- 【标注】呼吸灯包裹品牌文字 -->
            <div class="tech-circle-wrapper">
              <div class="tech-circle"></div>
              <div class="circle-content">
                <h1>XOAI Home</h1>
                <p class="subtitle">智控未来 · 极简生活</p>
              </div>
            </div>

            <!-- 【标注】广告/功能介绍区域 -->
            <div class="ad-section">
              <div class="ad-title">智慧生活 从这里开始</div>
              <div class="ad-text">
                一站式智能家居控制中心，让您的生活更加便捷、舒适、安全。<br>
                支持多种设备接入，场景自由定制。
              </div>
              <div class="ad-tags">
                <span class="ad-tag">全屋智能</span>
                <span class="ad-tag">语音控制</span>
                <span class="ad-tag">场景联动</span>
                <span class="ad-tag">远程控制</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 【标注】右侧：登录操作区 -->
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

          <!-- 【标注】底部栏：语言选择器 + 帮助链接 -->
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

  /** 【标注】关闭 Shadow DOM，样式直接挂载到组件本身（Light DOM） */
  createRenderRoot() {
    return this;
  }

  /**
   * 【标注】firstUpdated —— 首次渲染后的初始化逻辑
   * 依次执行：
   *   1. 验证 redirectUri 合法性（格式 + 危险协议检查）
   *   2. 发起获取认证提供者列表的请求
   *   3. 如果系统偏好深色模式，应用深色主题
   *   4. 如果是本实例登录，注册 Service Worker
   *   5. 懒加载语言选择器组件
   */
  protected firstUpdated(changedProps: PropertyValues) {
    super.firstUpdated(changedProps);

    // 【标注】安全校验：redirectUri 不能为空
    if (!this.redirectUri) {
      this._error = "Invalid redirect URI";
      return;
    }

    let url: URL;

    try {
      url = new URL(this.redirectUri);
    } catch (_err) {
      // 【标注】安全校验：redirectUri 必须是合法的 URL
      this._error = "Invalid redirect URI";
      return;
    }

    // 【标注】安全校验：阻止危险协议（javascript: / data: / vbscript: / file: / about:）
    if (
      // eslint-disable-next-line no-script-url
      ["javascript:", "data:", "vbscript:", "file:", "about:"].includes(
        url.protocol
      )
    ) {
      this._error = "Invalid redirect URI";
      return;
    }

    // 【标注】获取认证提供者列表（用户名密码、MFA、OAuth等）
    this._fetchAuthProviders();

    // 【修改】强制应用深色主题，不依赖系统偏好
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

    // 【标注】如果 redirectUri 指向本实例，注册 Service Worker 用于预加载资源
    if (url.host === location.host) {
      this._ownInstance = true;
      registerServiceWorker(this, false);
    }

    // 【标注】懒加载语言选择器（按需 import）
    import("../components/ha-language-picker");
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);
    // 【标注】语言变化时，更新 <html> 标签的 lang 属性
    if (changedProps.has("language")) {
      document.querySelector("html")!.setAttribute("lang", this.language!);
    }
  }

  /**
   * 【标注】获取认证提供者列表
   * 从后端 API 获取可用的认证方式（如用户名密码、LDAP、OAuth 等）
   * 如果返回 onboarding_required → 跳转到首次设置页面
   */
  private async _fetchAuthProviders() {
    // Fetch auth providers
    try {
      // 【标注】优先使用预取的数据（在 authorize.html.template 中预加载），否则发起新请求
      const response = await ((window as any).providersPromise ||
        fetchAuthProviders());
      const authProviders = await response.json();

      // 【标注】如果返回 onboarding_required，说明是首次使用，跳转到初始化页面
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

      // 【标注】保存提供者列表，默认选中第一个
      this._authProviders = authProviders.providers;
      this._authProvider = authProviders.providers[0];
      this._preselectStoreToken = authProviders.preselect_remember_me;
    } catch (err: any) {
      this._error = "Unable to fetch auth providers.";
      // eslint-disable-next-line
      console.error("Error loading auth providers", err);
    }
  }

  /** 【标注】处理用户切换认证提供者事件 */
  private async _handleAuthProviderPick(ev) {
    this._authProvider = ev.detail;
  }

  /** 【标注】处理语言切换 —— 更新组件语言 + 保存到 localStorage */
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
