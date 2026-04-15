import { css } from "lit";
import { customElement } from "lit/decorators";
import { HaFormString } from "../components/ha-form/ha-form-string";
import "../components/ha-icon-button";
import "../components/input/ha-input";

// ═══════════════════════════════════════════════════════
// 【标注】HaAuthFormString —— 认证表单的字符串输入字段
// 继承自通用 HaFormString 组件，用于渲染用户名、密码等文本输入框
//
// 两个关键定制：
//   1. createRenderRoot() 返回 this —— 关闭 Shadow DOM，
//      使得样式可以直接作用于元素，与 ha-auth-flow 的透明表单样式兼容
//   2. connectedCallback 中设置 position: relative —— 为后续可能的
//      密码可见切换按钮等绝对定位子元素提供参考容器
// ═══════════════════════════════════════════════════════
@customElement("ha-auth-form-string")
export class HaAuthFormString extends HaFormString {
  /** 【标注】关闭 Shadow DOM，使输入框直接使用父组件的样式 */
  protected createRenderRoot() {
    return this;
  }

  /**
   * 【标注】组件挂载时设置 position: relative
   * 为子元素（如密码可见切换图标）提供定位参考
   */
  public connectedCallback(): void {
    super.connectedCallback();
    this.style.position = "relative";
  }

  /** 【新增】强制覆盖输入框文字颜色，确保在深色背景下清晰可见 */
  static styles = [
    HaFormString.styles,
    css`
      /* 强制设置输入框文字颜色为白色 */
      ha-input {
        --wa-input-color: #ffffff !important;
        color: #ffffff !important;
      }
      /* 针对 wa-input 内部的 input 元素 */
      ha-input::part(input) {
        color: #ffffff !important;
        caret-color: #60a5fa;
      }
      /* 占位符颜色 */
      ha-input::part(placeholder) {
        color: #94a3b8 !important;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-auth-form-string": HaAuthFormString;
  }
}
