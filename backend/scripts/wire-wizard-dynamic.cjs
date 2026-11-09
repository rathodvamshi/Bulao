const fs = require('fs');
const path = require('path');

// 1. Update ServiceDetailsStep.tsx
const detailsPath = path.resolve('mobile/src/components/service/ServiceDetailsStep.tsx');
let dt = fs.readFileSync(detailsPath, 'utf8');

if (!dt.includes('CategoryFormRenderer')) {
  dt = dt.replace(
    'import type { ServiceOption, ServiceOptionsResponse } from "../../api/types";',
    `import type { ServiceOption, ServiceOptionsResponse } from "../../api/types";\r\nimport type { CategoryFormSchema, ServiceOffering } from "@bulao/domain";\r\nimport { CategoryFormRenderer } from "./form-engine/CategoryFormRenderer";\r\nimport { OfferingManager } from "./form-engine/OfferingManager";`
  );

  dt = dt.replace(
    '  onChangeCategory?: () => void;',
    `  onChangeCategory?: () => void;\r\n  schema?: CategoryFormSchema;\r\n  dynamicAnswers?: Record<string, any>;\r\n  onChangeDynamicAnswer?: (key: string, value: any) => void;\r\n  offerings?: ServiceOffering[];\r\n  onChangeOfferings?: (offerings: ServiceOffering[]) => void;`
  );

  dt = dt.replace(
    '  onChangeCategory,',
    `  onChangeCategory,\r\n  schema,\r\n  dynamicAnswers,\r\n  onChangeDynamicAnswer,\r\n  offerings,\r\n  onChangeOfferings,`
  );

  dt = dt.replace(
    '{/* ── 7. Info Helper Banner ── */}',
    `{/* ── Category-Specific Dynamic Form ── */}\r\n      {schema && dynamicAnswers && onChangeDynamicAnswer && (\r\n        <CategoryFormRenderer\r\n          schema={schema}\r\n          answers={dynamicAnswers}\r\n          onChangeAnswer={onChangeDynamicAnswer}\r\n        />\r\n      )}\r\n\r\n      {/* ── Service Offerings & Pricing Engine ── */}\r\n      {offerings && onChangeOfferings && (\r\n        <OfferingManager\r\n          categoryId={categoryId}\r\n          categoryName={categoryName}\r\n          offerings={offerings}\r\n          onChangeOfferings={onChangeOfferings}\r\n        />\r\n      )}\r\n\r\n      {/* ── 7. Info Helper Banner ── */}`
  );

  fs.writeFileSync(detailsPath, dt, 'utf8');
  console.log('ServiceDetailsStep updated successfully.');
}

// 2. Update CreateServiceWizard.tsx
const wizardPath = path.resolve('mobile/src/components/service/CreateServiceWizard.tsx');
let wz = fs.readFileSync(wizardPath, 'utf8');

if (!wz.includes('dynamicAnswers')) {
  wz = wz.replace(
    'import type { Category, Catalog, CategoryService } from "../../api/types";',
    `import type { Category, Catalog, CategoryService } from "../../api/types";\r\nimport type { CategoryFormSchema, ServiceOffering, ProviderCommonProfile } from "@bulao/domain";\r\nimport { CATEGORY_SCHEMAS } from "@bulao/domain";`
  );

  // Add state hooks
  wz = wz.replace(
    'const [facebook, setFacebook] = useState<string>("");',
    `const [facebook, setFacebook] = useState<string>("");\r\n  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, any>>({});\r\n  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);\r\n  const [commonProfile, setCommonProfile] = useState<Partial<ProviderCommonProfile>>({});`
  );

  // Schema query
  wz = wz.replace(
    'const catalogQuery = useQuery({',
    `const schemaQuery = useQuery({\r\n    queryKey: ["category-schema", categoryId],\r\n    queryFn: () => api<CategoryFormSchema>(\`/service/categories/\${categoryId}/schema\`).catch(() => CATEGORY_SCHEMAS[categoryId]),\r\n    enabled: Boolean(categoryId),\r\n    staleTime: 60 * 60 * 1000,\r\n  });\r\n\r\n  const catalogQuery = useQuery({`
  );

  // Pass props to ServiceDetailsStep
  wz = wz.replace(
    'onRemoveCustomService={handleRemoveCustomService}',
    `onRemoveCustomService={handleRemoveCustomService}\r\n            schema={schemaQuery.data || CATEGORY_SCHEMAS[categoryId]}\r\n            dynamicAnswers={dynamicAnswers}\r\n            onChangeDynamicAnswer={(k, v) => setDynamicAnswers((prev) => ({ ...prev, [k]: v }))}\r\n            offerings={offerings}\r\n            onChangeOfferings={setOfferings}`
  );

  // In publishMutation, persist offerings and dynamic answers
  wz = wz.replace(
    'customServices,',
    `customServices,\r\n          dynamicAnswers,\r\n          offerings,`
  );

  fs.writeFileSync(wizardPath, wz, 'utf8');
  console.log('CreateServiceWizard updated successfully.');
}
