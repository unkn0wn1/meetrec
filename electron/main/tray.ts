import {
  Menu,
  Tray,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'
import { buildTrayModel, type TrayActionId, type TrayModel } from '../domains/calendar/tray-model'
import { showMeetrecWindow } from './app-lifecycle'

const TRAY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAsklEQVR4nO2WQQrCMBBF/0kR8QJi4Q28gBdQ8AJeQMvNPbiCR3DzDk6g4AXcwA0sFBH1IyKbTdK0CfnJZzKZ/CGhA0pHnAEnwAkwA5wBJ8AJMAOcASfACXACnAAn4AVYgU7AC7ACXsALsAJewAuwAl7AC7ACXsALsAJewAuwAl7AC3gBVuAFeIEX4AVegBd4AV7gBXiBF+AFXoAXeAFe4AV4gRfgBV6AF3gBXuAFeIEX4AVegBd4AV7gBXiBF+AFXoAXeAFe4AU+A1b/AVb+A34BKm0n1m0n1j0AAAAASUVORK5CYII=',
  'base64'
)

export interface TrayController {
  render: (model: TrayModel) => void
}

export function createTray(
  window: BrowserWindow,
  onAction: (id: TrayActionId) => void
): TrayController {
  const image = nativeImage.createFromBuffer(TRAY_PNG).resize({ width: 16, height: 16 })
  const tray = new Tray(image)
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
