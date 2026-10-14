export const investigationDashletTitles = {
  description: 'Description', contacts: 'Contacts', organizations: 'Organizations',
  publications: 'Publications', assays: 'Assays', studies: 'Studies', runs: 'Runs', workflows: 'Workflows', webview: 'Webview',
} as const
export type InvestigationDashletId = keyof typeof investigationDashletTitles
export const investigationDetailIds = ['description', 'contacts', 'organizations', 'publications', 'assays', 'studies', 'runs', 'workflows'] as const satisfies readonly InvestigationDashletId[]
