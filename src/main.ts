import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import tooltip from '@meesayen/pure-tooltip/vue';

const app = createApp(App);
app.use(tooltip);
app.mount('#app');
