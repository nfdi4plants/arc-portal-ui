// Import each of the themes you would like to use, by default we are including
// the light theme below
import '@primer/primitives/dist/css/functional/themes/light.css'
import {BaseStyles} from '@primer/react'
import {ThemeProvider} from '@primer/react/next'
import {Button} from '@primer/react'
import {useState} from 'react'
import '@primer/css/dist/primer.css'


function MyComponent() {
  const [count, setCount] = useState(0)

  return <Button variant="primary" onClick={() => setCount(count + 1)}>Click me {count}</Button>
}

function RootLayout() {
  return (
    <ThemeProvider>
      <BaseStyles>
        <MyComponent />
      </BaseStyles>
    </ThemeProvider>
  )
}

export default RootLayout