import { mdiAccountGroup, mdiFileDocument, mdiTabletCellphone } from "@mdi/js";
import type { TemplateResult } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators";
import type { LocalizeFunc } from "../common/translations/localize";
import "../components/ha-card";
import { showAppDialog } from "./dialogs/show-app-dialog";
import { showCommunityDialog } from "./dialogs/show-community-dialog";
import "./onboarding-welcome-link";

@customElement("onboarding-welcome-links")
class OnboardingWelcomeLinks extends LitElement {
  @property({ attribute: false }) public localize!: LocalizeFunc<any>;

  @property({ attribute: "mobile-app", type: Boolean })
  public mobileApp = false;

  protected render(): TemplateResult {
    return html`<a
        target="_blank"
        rel="noreferrer noopener"
        href="https://www.home-assistant.io/blog/2016/01/19/perfect-home-automation/"
      >
        <onboarding-welcome-link
          noninteractive
          .iconPath=${mdiFileDocument}
          .label=${this.localize("ui.panel.page-onboarding.welcome.vision")}
        >
        </onboarding-welcome-link>
      </a>
      <onboarding-welcome-link
        class="community"
        @click=${this._openCommunity}
        .iconPath=${mdiAccountGroup}
        .label=${this.localize("ui.panel.page-onboarding.welcome.community")}
      >
      </onboarding-welcome-link>
      ${this.mobileApp
        ? nothing
        : html`<onboarding-welcome-link
            class="app"
            @click=${this._openApp}
            .iconPath=${mdiTabletCellphone}
            .label=${this.localize(
              "ui.panel.page-onboarding.welcome.download_app"
            )}
          >
          </onboarding-welcome-link>`}`;
  }

  private _openCommunity(): void {
    showCommunityDialog(this, { localize: this.localize });
  }

  private _openApp(): void {
    showAppDialog(this, { localize: this.localize });
  }

  // ═══════════════════════════════════════════════════════
  // 【样式修改】对齐登录界面样式 - 底部链接卡片
  // 修改时间：2026-04-16
  // 修改内容：
  //   1. 链接卡片添加毛玻璃效果
  //   2. 添加悬停动画效果
  //   3. 调整颜色主题（绿色、紫色）
  //   4. 优化响应式布局
  // ═══════════════════════════════════════════════════════
  static styles = css`
    :host {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      margin-top: 16px;
      gap: var(--ha-space-3);
      width: 100%;
      max-width: 440px;
    }

    /* 【优化】链接卡片 - 增强毛玻璃效果和阴影 */
    onboarding-welcome-link {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 18px 14px;
      transition: all 0.3s ease;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    onboarding-welcome-link:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(96, 165, 250, 0.4);
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    /* 【修改】颜色主题 */
    .community {
      --welcome-link-color: #10b981;
    }
    .app {
      --welcome-link-color: #a78bfa;
    }

    a {
      text-decoration: none;
    }

    @media (max-width: 550px) {
      :host {
        grid-template-columns: 1fr;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "onboarding-welcome-links": OnboardingWelcomeLinks;
  }
}
