import { Menu, Tray, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { buildTrayModel, type TrayActionId, type TrayModel } from '../domains/calendar/tray-model'
import { showMeetrecWindow } from './app-lifecycle'
import { loadTrayImage } from './app-icon'

export interface TrayController {
  render: (model: TrayModel) => void
}

export function createTray(
  window: BrowserWindow,
  onAction: (id: TrayActionId) => void
): TrayController {
  const tray = new Tray(loadTrayImage())
  const render = (model: TrayModel): void => {
    tray.setToolTip(model.tooltip)
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(model, onAction)))
  }
  render(
    buildTrayModel({
      recording: false,
      prompt: null,
      arm: null,
      startAllowed: false,
      next: null
    })
  )
  tray.on('click', () => {
    showMeetrecWindow(window)
  })
  return { render }
}

function menuTemplate(
  model: TrayModel,
  onAction: (id: TrayActionId) => void
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = []
  const middle = model.items.filter((item) => item.id !== 'show' && item.id !== 'quit')
  template.push({
    label: 'Show meetrec',
    click: () => {
      onAction('show')
    }
  })
  if (middle.length > 0) template.push({ type: 'separator' })
  for (const item of middle) {
    template.push({
      label: item.label,
      enabled: item.id !== 'armed',
      click: () => {
        onAction(item.id)
      }
    })
  }
  if (middle.length > 0) template.push({ type: 'separator' })
  template.push({
    label: 'Quit',
    click: () => {
      onAction('quit')
    }
  })
  return template
}
