import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import type { Preview } from '@storybook/react-vite'
import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    options: {
      storySort: {
        order: ['Dashboard', ['Main', 'ScrollingDashboard', 'SplitDashboard', 'TabbedDashboard', 'ScrollingSplitDashboard', 'HubDashboard', 'CombinedDashboard', 'StackedDashboard', 'NewDashboard', 'ClassicDashboard'], '*'],
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <BaseStyles>
          <Story />
        </BaseStyles>
      </ThemeProvider>
    ),
  ],
}

export default preview
