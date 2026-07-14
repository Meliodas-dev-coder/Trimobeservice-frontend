import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import Aura from '@primeuix/themes/aura';
import AutoComplete from 'primevue/autocomplete';
import Button from 'primevue/button';
import Carousel from 'primevue/carousel';
import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import Toast from 'primevue/toast';
import Divider from 'primevue/divider';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import RadioButton from 'primevue/radiobutton';
import Ripple from 'primevue/ripple';
import Select from 'primevue/select';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

import 'primeicons/primeicons.css';
import '@/styles/base.css';
import '@/styles/theme.css';
import '@/styles/public.css';

import App from '@/App.vue';
import router from '@/router';
import { useAuthStore } from '@/stores/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  ripple: true,
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.trimobe-dark',
    },
  },
});
app.use(ToastService);
app.use(ConfirmationService);

app.directive('ripple', Ripple);

app.component('AutoComplete', AutoComplete);
app.component('Button', Button);
app.component('Carousel', Carousel);
app.component('Checkbox', Checkbox);
app.component('Column', Column);
app.component('ConfirmDialog', ConfirmDialog);
app.component('DataTable', DataTable);
app.component('DatePicker', DatePicker);
app.component('Dialog', Dialog);
app.component('Toast', Toast);
app.component('Divider', Divider);
app.component('IconField', IconField);
app.component('InputIcon', InputIcon);
app.component('InputNumber', InputNumber);
app.component('InputText', InputText);
app.component('Password', Password);
app.component('RadioButton', RadioButton);
app.component('Select', Select);
app.component('Skeleton', Skeleton);
app.component('Tag', Tag);
app.component('Textarea', Textarea);

// Restore any existing session before mounting so route guards see the correct
// auth state on the first navigation. ensureReady() dedupes with the guard.
const auth = useAuthStore(pinia);
auth.ensureReady().finally(() => app.mount('#app'));
