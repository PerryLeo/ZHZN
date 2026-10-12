import App from './App'
import AppUpdatePopup from './components/app-update-popup/app-update-popup.vue'
import { appUpdateState } from './common/appUpdate.js'

const updateGuard = {
  onBackPress() {
    if (appUpdateState.visible) return true
  }
}

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.component('app-update-popup', AppUpdatePopup)
Vue.mixin(updateGuard)
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  app.component('app-update-popup', AppUpdatePopup)
  app.mixin(updateGuard)
  return {
    app
  }
}
// #endif