<template>
  <div class="app-versions">
    <section class="panel">
      <div class="panel-header"><div><h2>上传 App 安装包</h2><p>自动读取版本及包名并校验 APK 签名，保存后需手动发布</p></div><span class="role-tag">Android · 最大 200 MB</span></div>
      <div class="release-form">
        <div class="form-field"><label>APK 安装包</label><input ref="fileInput" type="file" accept=".apk,application/vnd.android.package-archive" :disabled="uploading" @change="chooseFile"></div>
        <p v-if="candidate" class="upload-info">{{ candidate.name }} · {{ formatBytes(candidate.size) }}</p>
        <label class="force-choice"><input v-model="force" type="checkbox" :disabled="uploading">强制更新（用户安装新版本后才能继续使用）</label>
        <div v-if="uploading" class="upload-progress"><progress :value="uploadProgress" max="100"></progress><span>{{ uploadProgress === 100 ? '上传完成，正在校验 APK…' : `正在上传 ${uploadProgress}%` }}</span></div>
        <div class="release-actions"><button class="primary-btn" type="button" :disabled="!candidate || uploading || acting" @click="upload">{{ uploading ? '正在处理…' : '上传并保存待发布版本' }}</button></div>
        <p class="release-hint">使用正式签名并启用 APK v2 签名。首次上传会确立 App 包名和签名；后续版本必须一致，versionCode 不可重复。</p>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><div><h2>版本记录</h2><p>同一时间仅一个版本对外发布；撤回后停止提示和新的下载</p></div><button class="secondary-btn" type="button" :disabled="loading || uploading || acting" @click="load(page)">刷新</button></div>
      <div v-if="loadError" class="release-error">{{ loadError }}</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>版本</th><th>安装包</th><th>更新方式</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="empty-state">正在加载版本…</td></tr>
          <tr v-else-if="!releases.length"><td colspan="6" class="empty-state">暂无 App 版本</td></tr>
          <tr v-for="release in releases" :key="release.id">
            <td><strong>{{ release.versionName }}</strong><small class="release-subline">versionCode：{{ release.versionCode }}</small></td>
            <td>{{ formatBytes(release.fileSize) }}<small class="release-subline">{{ release.packageName }}</small></td>
            <td><span class="tag" :class="release.forceUpdate ? 'warning' : ''">{{ release.forceUpdate ? '强制更新' : '普通更新' }}</span></td>
            <td><span class="tag" :class="release.status === 'published' ? 'success' : ''">{{ statusLabel(release.status) }}</span></td>
            <td>{{ formatTime(release.publishedAt) }}</td>
            <td><div class="row-actions">
              <button class="text-btn" type="button" @click="showDetails(release)">详情</button>
              <button v-if="['draft', 'withdrawn'].includes(release.status)" class="text-btn" type="button" :disabled="acting || uploading" @click="openEdit(release)">编辑</button>
              <button v-if="['draft', 'withdrawn'].includes(release.status)" class="text-btn" type="button" :disabled="acting || uploading" @click="confirmAction(release, 'publish')">发布</button>
              <button v-if="release.status === 'published'" class="text-btn danger" type="button" :disabled="acting || uploading" @click="confirmAction(release, 'withdraw')">撤回</button>
            </div></td>
          </tr>
        </tbody>
      </table><AppPagination :page="page" :total="total" :total-pages="totalPages" @change="load" /></div>
    </section>
    <AppModal v-model="editVisible" title="编辑版本" :loading="acting" @confirm="saveEdit">
      <div class="form-field"><label>版本 {{ editing?.versionName }}</label></div>
      <label class="force-choice"><input v-model="editForce" type="checkbox">强制更新</label>
    </AppModal>
    <AppModal v-model="actionVisible" :title="pendingAction === 'publish' ? '发布 App 版本' : '撤回 App 版本'" :confirm-text="pendingAction === 'publish' ? '确认发布' : '确认撤回'" :danger="pendingAction === 'withdraw'" :loading="acting" @confirm="runAction">
      <p>{{ pendingAction === 'publish' ? '发布后，打开 App 的用户将收到更新提示。' : '撤回后将停止更新提示及新的下载，已经安装的版本不会回退。' }}</p>
      <p><strong>{{ actionRelease?.versionName }}</strong> · {{ actionRelease?.forceUpdate ? '强制更新' : '普通更新' }}</p>
    </AppModal>
    <AppModal v-model="detailVisible" title="版本详情" confirm-text="关闭" :show-cancel="false" @confirm="detailVisible = false">
      <template v-if="detail"><p><strong>{{ detail.versionName }}</strong> · versionCode {{ detail.versionCode }}</p><p>{{ detail.packageName }}</p><p>上传人：{{ detail.operatorName || '--' }} · {{ formatTime(detail.createdAt) }}</p><label>APK SHA-256</label><p class="release-hash">{{ detail.sha256 }}</p><label>签名证书 SHA-256</label><p class="release-hash">{{ detail.certificateSha256 }}</p></template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../services/api.js';
import { showToast } from '../utils/toast.js';
import { formatTime } from '../utils/format.js';
import AppModal from '../components/AppModal.vue';
import AppPagination from '../components/AppPagination.vue';

const candidate = ref(null), fileInput = ref(null), force = ref(false), uploading = ref(false), uploadProgress = ref(0);
const releases = ref([]), loading = ref(false), loadError = ref(''), page = ref(1), total = ref(0), totalPages = ref(0), acting = ref(false);
const editVisible = ref(false), editing = ref(null), editForce = ref(false);
const actionVisible = ref(false), pendingAction = ref(''), actionRelease = ref(null), detailVisible = ref(false), detail = ref(null);
const formatBytes = size => `${(Number(size) / 1024 / 1024).toFixed(2)} MB`;
const statusLabel = status => ({ draft: '待发布', published: '已发布', withdrawn: '已撤回', archived: '历史归档' }[status] || status);
const chooseFile = event => {
  const file = event.target.files?.[0];
  candidate.value = null;
  if (!file) return;
  if (!/\.apk$/i.test(file.name) || !file.size || file.size > 200 * 1024 * 1024) { showToast('请选择不超过 200 MB 的非空 APK 文件', 'error'); event.target.value = ''; return; }
  candidate.value = file;
};
const load = async (nextPage = 1) => {
  if (loading.value) return;
  loading.value = true; loadError.value = '';
  try { const result = await api.get('/api/app/releases', { page: nextPage }); releases.value = result.list; page.value = result.page; total.value = result.total; totalPages.value = result.totalPages; }
  catch (error) { loadError.value = error.message; showToast(error.message, 'error'); }
  finally { loading.value = false; }
};
const upload = async () => {
  if (!candidate.value || uploading.value) return;
  uploading.value = true; uploadProgress.value = 0;
  let saved;
  try {
    saved = await api.uploadBinaryProgress('/api/app/releases', candidate.value, value => { uploadProgress.value = value; });
    await api.put(`/api/app/releases/${saved.id}`, { forceUpdate: force.value });
    showToast(`版本 ${saved.versionName} 已保存，请确认后发布`);
    candidate.value = null; fileInput.value.value = ''; force.value = false;
  } catch (error) { showToast(saved ? `APK 已保存，更新方式保存失败，请在记录中编辑：${error.message}` : error.message, 'error'); }
  finally { uploading.value = false; await load(1); }
};
const openEdit = release => { editing.value = release; editForce.value = release.forceUpdate; editVisible.value = true; };
const saveEdit = async () => {
  if (acting.value) return;
  acting.value = true;
  try { await api.put(`/api/app/releases/${editing.value.id}`, { forceUpdate: editForce.value }); editVisible.value = false; showToast('版本信息已保存'); await load(page.value); }
  catch (error) { showToast(error.message, 'error'); }
  finally { acting.value = false; }
};
const confirmAction = (release, action) => { actionRelease.value = release; pendingAction.value = action; actionVisible.value = true; };
const runAction = async () => {
  if (acting.value) return;
  acting.value = true;
  try { await api.post(`/api/app/releases/${actionRelease.value.id}/${pendingAction.value}`); actionVisible.value = false; showToast(pendingAction.value === 'publish' ? '版本已发布' : '已撤回发布'); await load(page.value); }
  catch (error) { showToast(error.message, 'error'); }
  finally { acting.value = false; }
};
const showDetails = release => { detail.value = release; detailVisible.value = true; };
onMounted(() => load());
</script>

<style scoped>
.app-versions > .panel + .panel { margin-top: 24px; }
.release-form { padding: 24px; }
.force-choice { display: flex; align-items: center; font-size: 14px; }
.force-choice input { margin-right: 8px; }
.upload-info, .release-hint { color: #667085; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.release-hint { margin: 18px 0 0; }
.release-actions { margin-top: 20px; }
.upload-progress { display: flex; align-items: center; margin-top: 18px; font-size: 13px; color: #667085; }
.upload-progress progress { width: 240px; height: 12px; margin-right: 16px; accent-color: #ef8b2c; }
.release-subline { display: block; margin-top: 6px; font-size: 12px; color: #98a2b3; }
.row-actions { display: flex; white-space: nowrap; }
.row-actions button + button { margin-left: 14px; }
.release-hash { overflow-wrap: anywhere; font-family: monospace; font-size: 12px; }
.release-error { padding: 16px 24px; color: #e5484d; }
</style>
