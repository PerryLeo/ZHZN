<template>
    <view class="w-datetime-mask" @click="handleClose">
        <view class="w-datetime-panel" @click.stop>
            <view class="w-datetime-header">
                <text class="btn-cancel" @click="handleClose">取消</text>
                <text class="panel-title">{{ panelTitle }}</text>
                <text class="btn-confirm" @click="handleConfirm">确定</text>
            </view>
            <picker-view class="w-datetime-picker" :indicator-style="indicatorStyle" :value="pickerValue"
                @change="handleChange">
                <picker-view-column v-if="showDate">
                    <view class="picker-item" v-for="(y, i) in years" :key="i">{{ y }}年</view>
                </picker-view-column>
                <picker-view-column v-if="showDate">
                    <view class="picker-item" v-for="(m, i) in months" :key="i">{{ m }}月</view>
                </picker-view-column>
                <picker-view-column v-if="showDate">
                    <view class="picker-item" v-for="(d, i) in days" :key="i">{{ d }}日</view>
                </picker-view-column>
                <picker-view-column v-if="showTime">
                    <view class="picker-item" v-for="(h, i) in hours" :key="i">{{ padZero(h) }}时</view>
                </picker-view-column>
                <picker-view-column v-if="showTime">
                    <view class="picker-item" v-for="(min, i) in minutes" :key="i">{{ padZero(min) }}分</view>
                </picker-view-column>
            </picker-view>
        </view>
    </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
    pickerType: { type: String, default: 'datetime' },
    pickerVal: { type: String, default: '' },
    pickerShow: { type: Boolean, default: true }
});

const emit = defineEmits(['sureClk', 'closePicker']);

const START_YEAR = 1990;
const now = new Date();
const NOW_YEAR = now.getFullYear();

const padZero = (n) => String(n).padStart(2, '0');

const getMonthDays = (year, month) => new Date(year, month, 0).getDate();

const showDate = computed(() => props.pickerType.includes('date'));
const showTime = computed(() => props.pickerType.includes('time'));

const panelTitle = computed(() => {
    if (props.pickerType === 'date') return '选择日期';
    if (props.pickerType === 'time') return '选择时间';
    return '选择日期时间';
});

const years = Array.from({ length: NOW_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);

const days = ref([]);

const refreshDays = (year, month) => {
    const count = getMonthDays(year, month);
    days.value = Array.from({ length: count }, (_, i) => i + 1);
};

const selYear = ref(NOW_YEAR);
const selMonth = ref(now.getMonth() + 1);
const selDay = ref(now.getDate());
const selHour = ref(now.getHours());
const selMin = ref(now.getMinutes());

const pickerValue = ref([]);

const indicatorStyle = 'height: 44px;';

const parseAndInit = (val) => {
    let y = NOW_YEAR;
    let mo = now.getMonth() + 1;
    let d = now.getDate();
    let h = now.getHours();
    let mi = now.getMinutes();

    if (val && !val.includes('请选择')) {
        let full = val;
        if (!full.includes('-')) {
            full = `${NOW_YEAR}-${mo}-${d} ${full}`;
        } else if (!full.includes(':')) {
            full = `${full} ${h}:${mi}`;
        }
        const [datePart, timePart] = full.split(' ');
        const parts = datePart.split('-').map(Number);
        const tParts = timePart.split(':').map(Number);
        y = parts[0] || NOW_YEAR;
        mo = parts[1] || 1;
        d = parts[2] || 1;
        h = tParts[0] ?? 0;
        mi = tParts[1] ?? 0;
    }

    selYear.value = y;
    selMonth.value = mo;
    selDay.value = d;
    selHour.value = h;
    selMin.value = mi;

    refreshDays(y, mo);

    const maxDay = days.value.length;
    if (selDay.value > maxDay) selDay.value = maxDay;

    if (props.pickerType === 'time') {
        pickerValue.value = [selHour.value, selMin.value];
    } else if (props.pickerType === 'date') {
        pickerValue.value = [
            selYear.value - START_YEAR,
            selMonth.value - 1,
            selDay.value - 1
        ];
    } else {
        pickerValue.value = [
            selYear.value - START_YEAR,
            selMonth.value - 1,
            selDay.value - 1,
            selHour.value,
            selMin.value
        ];
    }
};

onMounted(() => {
    parseAndInit(props.pickerVal);
});

const handleChange = (e) => {
    const idx = e.detail.value;

    if (props.pickerType === 'time') {
        selHour.value = hours[idx[0]];
        selMin.value = minutes[idx[1]];
        pickerValue.value = [idx[0], idx[1]];

    } else if (props.pickerType === 'date') {
        selYear.value = years[idx[0]];
        selMonth.value = months[idx[1]];
        refreshDays(selYear.value, selMonth.value);
        const safeDay = Math.min(idx[2], days.value.length - 1);
        selDay.value = days.value[safeDay];
        pickerValue.value = [idx[0], idx[1], safeDay];

    } else {
        selYear.value = years[idx[0]];
        selMonth.value = months[idx[1]];
        refreshDays(selYear.value, selMonth.value);
        const safeDay = Math.min(idx[2], days.value.length - 1);
        selDay.value = days.value[safeDay];
        selHour.value = hours[idx[3]];
        selMin.value = minutes[idx[4]];
        pickerValue.value = [idx[0], idx[1], safeDay, idx[3], idx[4]];
    }
};

const handleConfirm = () => {
    const y = selYear.value;
    const mo = padZero(selMonth.value);
    const d = padZero(selDay.value);
    const h = padZero(selHour.value);
    const mi = padZero(selMin.value);

    let result;
    if (props.pickerType === 'date') result = `${y}-${mo}-${d}`;
    else if (props.pickerType === 'time') result = `${h}:${mi}`;
    else result = `${y}-${mo}-${d} ${h}:${mi}`;

    emit('sureClk', result);
};

const handleClose = () => {
    emit('closePicker');
};
</script>

<style lang="scss" scoped>
.w-datetime-mask {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: rgba(0, 0, 0, 0.45);
    animation: wdt-fade-in 0.2s ease forwards;
}

.w-datetime-panel {
    width: 100%;
    background: #fff;
    border-radius: 24rpx 24rpx 0 0;
    overflow: hidden;
    animation: wdt-slide-up 0.25s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}

.w-datetime-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32rpx;
    height: 88rpx;
    background: #fff;
    border-bottom: 1rpx solid #EFEFEF;

    .panel-title {
        font-size: 30rpx;
        font-weight: 600;
        color: #333;
    }

    .btn-cancel {
        font-size: 28rpx;
        color: #909399;
        padding: 10rpx 0;
    }

    .btn-confirm {
        font-size: 28rpx;
        font-weight: 600;
        color: $primary-color;
        padding: 10rpx 0;
    }
}

.w-datetime-picker {
    width: 100%;
    height: 528rpx;
    background: #fff;
}

.picker-item {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    font-size: 30rpx;
    color: #333;
}

@keyframes wdt-fade-in {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes wdt-slide-up {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}
</style>
