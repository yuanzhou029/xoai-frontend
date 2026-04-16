import "@home-assistant/webawesome/dist/components/divider/divider";
import type { CSSResultGroup, TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators";
import { fireEvent } from "../common/dom/fire_event";
import type { LocalizeFunc } from "../common/translations/localize";
import "../components/ha-button";
import "../components/ha-icon-button-next";
import "../components/ha-md-list";
import "../components/ha-md-list-item";
import type { HomeAssistant } from "../types";
import { onBoardingStyles } from "./styles";

@customElement("onboarding-welcome")
class OnboardingWelcome extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public localize!: LocalizeFunc;

  protected render(): TemplateResult {
    return html`
      <h1>${this.localize("ui.panel.page-onboarding.welcome.header")}</h1>
      <p>${this.localize("ui.panel.page-onboarding.intro")}</p>

      <ha-button @click=${this._start} class="start">
        ${this.localize("ui.panel.page-onboarding.welcome.start")}
      </ha-button>

      <div class="divider">
        <wa-divider></wa-divider>
        <div>
          <span
            >${this.localize(
              "ui.panel.page-onboarding.welcome.or_restore"
            )}</span
          >
        </div>
      </div>

      <ha-md-list>
        <ha-md-list-item type="button" @click=${this._restoreBackupUpload}>
          <div slot="headline">
            ${this.localize("ui.panel.page-onboarding.restore.upload_backup")}
          </div>
          <div slot="supporting-text">
            ${this.localize(
              "ui.panel.page-onboarding.restore.options.upload_description"
            )}
          </div>
          <ha-icon-button-next slot="end"></ha-icon-button-next>
        </ha-md-list-item>
        <ha-md-list-item type="button" @click=${this._restoreBackupCloud}>
          <div slot="headline">Home Assistant Cloud</div>
          <div slot="supporting-text">
            ${this.localize(
              "ui.panel.page-onboarding.restore.ha-cloud.description"
            )}
          </div>
          <ha-icon-button-next slot="end"></ha-icon-button-next>
        </ha-md-list-item>
      </ha-md-list>
    `;
  }

  private _start(): void {
    fireEvent(this, "onboarding-step", {
      type: "init",
    });
  }

  private _restoreBackupUpload(): void {
    fireEvent(this, "onboarding-step", {
      type: "init",
      result: { restore: "upload" },
    });
  }

  private _restoreBackupCloud(): void {
    fireEvent(this, "onboarding-step", {
      type: "init",
      result: { restore: "cloud" },
    });
  }

  // ═══════════════════════════════════════════════════════
  // 【样式修改】对齐登录界面样式 - 卡片内元素样式
  // 修改时间：2026-04-16
  // 修改内容：
  //   1. 标题改为白色文字（#f8fafc）
  //   2. 副标题改为浅灰色（#94a3b8）
  //   3. 主按钮改为渐变蓝色（#3b82f6 → #6366f1）
  //   4. 列表项添加半透明背景和边框
  //   5. 文字颜色调整为白色/浅灰
  // ═══════════════════════════════════════════════════════
  static get styles(): CSSResultGroup {
    return [
      onBoardingStyles,
      css`
        :host {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
        }

        /* 【优化】标题样式 - 提升对比度 */
        h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #ffffff;
          line-height: 1.3;
          letter-spacing: 0.5px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        /* 【优化】副标题 - 提升可读性 */
        p {
          font-size: 0.95rem;
          color: #cbd5e1;
          margin: 0 0 20px 0;
          line-height: 1.5;
        }

        /* 【优化】主按钮 - 无阴影 */
        .start {
          width: 100%;
          margin: var(--ha-space-6) 0;
          background: linear-gradient(135deg, #3b82f6, #6366f1) !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 14px 24px !important;
          color: white !important;
          font-weight: 600 !important;
          font-size: 1rem !important;
          letter-spacing: 0.5px !important;
          transition: all 0.3s ease !important;
        }

        .start:hover {
          background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
          transform: translateY(-2px);
        }

        /* 【优化】分隔线 - 深色主题 */
        .divider {
          width: 100%;
          position: relative;
          margin: var(--ha-space-4) 0;
        }

        .divider div {
          position: absolute;
          display: flex;
          justify-content: center;
          align-items: center;
          top: 0;
          bottom: 0;
          width: 100%;
        }

        .divider div span {
          background-color: rgba(15, 23, 42, 0.6);
          color: #94a3b8;
          padding: 0 var(--ha-space-4);
          font-size: 0.9rem;
        }

        /* 【优化】列表项 - 完全透明，无阴影 */
        ha-md-list {
          width: 100%;
          padding-bottom: 0;
          --md-list-item-leading-space: 0;
          --md-list-item-trailing-space: 0;
        }

        ha-md-list-item {
          background: transparent;
          border: 1px solid rgba(96, 165, 250, 0.25);
          border-radius: 12px;
          margin-bottom: 12px;
          transition: all 0.3s ease;
        }

        ha-md-list-item:hover {
          background: transparent;
          border-color: rgba(96, 165, 250, 0.4);
          transform: translateX(4px);
        }

        /* 【优化】列表项文字颜色 - 提升对比度 */
        ha-md-list-item div[slot="headline"] {
          color: #ffffff;
          font-weight: 500;
        }

        ha-md-list-item div[slot="supporting-text"] {
          color: #cbd5e1;
          font-size: 0.85rem;
        }

        /* 【修改】箭头图标颜色 */
        ha-icon-button-next {
          --mdc-icon-button-icon-color: #60a5fa;
          color: #60a5fa;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "onboarding-welcome": OnboardingWelcome;
  }
}
