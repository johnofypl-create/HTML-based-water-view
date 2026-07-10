/**
 * @module main
 * @layer root（根层）
 * @purpose 应用入口（挂载 React + Canvas）
 * @dependsOn ['App']
 * @exports []
 * @aiEdit
 *   - 改本文件导出的 组件 即可；依赖见 @dependsOn
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
