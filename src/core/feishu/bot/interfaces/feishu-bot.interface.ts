/**
 * Feishu Card Message Interface
 */
export interface IFeishuCard {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: "plain_text" | "lark_md";
      content: string;
    };
    template?:
      | "blue"
      | "wathet"
      | "turquoise"
      | "green"
      | "yellow"
      | "orange"
      | "red"
      | "carmine"
      | "violet"
      | "purple"
      | "indigo"
      | "grey";
  };
  elements: Array<{
    tag: string;
    [key: string]: unknown;
  }>;
}

/**
 * Feishu Message Request Interface
 */
export interface IFeishuMessageRequest {
  receive_id: string; // User open_id or chat_id
  msg_type: "text" | "post" | "image" | "interactive";
  content: string; // JSON string
}
