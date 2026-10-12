<script>
import { checkAndOpenAppUpdate } from '@/common/appUpdate.js';
export default {
	onLaunch: function () { },
	onShow: function () {
		setTimeout(() => {
			const pages = getCurrentPages();
			if (!pages.length || pages[pages.length - 1].route === 'pages/launch/index') return;
			checkAndOpenAppUpdate();
		}, 500);
	},
	onHide: function () { },
};
</script>

<style>
/*每个页面公共css */
@import '@/common/font/iconfont.css';
</style>
