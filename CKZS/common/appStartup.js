import { API_BASE_URL, TOKEN_KEY, USER_KEY } from './config.js';

export const navigateAfterStartup = () => {
    const token = uni.getStorageSync(TOKEN_KEY);
    if (!token) { uni.reLaunch({ url: '/pages/login/login' }); return; }
    uni.request({
        url: API_BASE_URL + '/api/users/profile', method: 'GET', timeout: 8000,
        header: { Authorization: `Bearer ${token}` },
        success: res => {
            if (res.data?.code === 0) {
                uni.setStorageSync(USER_KEY, JSON.stringify(res.data.data));
                uni.reLaunch({ url: '/pages/home/index' });
            } else {
                uni.removeStorageSync(TOKEN_KEY); uni.removeStorageSync(USER_KEY);
                uni.reLaunch({ url: '/pages/login/login' });
            }
        },
        fail: () => uni.reLaunch({ url: '/pages/home/index' }),
    });
};
