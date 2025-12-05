/**
 * 生成符合验证规则的产品示例数据
 * 使用数据库中实际存在的ACTIVE状态服务类型ID
 */

const validProductExample = {
  "name": "留学申请全程服务",
  "code": "SA-FULL-2024",
  "description": "提供全方位的留学申请服务，包括选校、文书、签证等",
  "coverImage": "https://example.com/cover.jpg",
  "targetUserPersonas": ["undergraduate", "graduate", "working"],
  "price": 12999.00,
  "currency": "CNY",
  "marketingLabels": ["hot", "recommended"],
  "metadata": {
    "features": ["全程服务", "专业指导", "一对一咨询"]
  },
  "items": [
    {
      "serviceTypeId": "758024ba-5ebb-47a2-82cd-0f2892317e20",
      "quantity": 10,
      "sortOrder": 1
    },
    {
      "serviceTypeId": "92361018-8ef7-455e-9fa3-c3d344fa599f",
      "quantity": 5,
      "sortOrder": 2
    },
    {
      "serviceTypeId": "29a91d0d-4d88-400e-9e41-b64b6b3baeee",
      "quantity": 3,
      "sortOrder": 3
    }
  ]
};

console.log("=== 修复后的产品示例数据 ===");
console.log(JSON.stringify(validProductExample, null, 2));

// 输出curl命令示例
console.log("\n=== 使用curl调用API的示例 ===");
console.log(`curl -X POST "http://localhost:3000/api/admin/products" \\\n  -H "Authorization: Bearer <your_admin_token>" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(validProductExample)}'`);
