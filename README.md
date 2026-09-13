# finly

Особистий бюджет: після зарплати кошики наповнюються за фіксом і відсотками. Списання з картки падають у список «Розкласти» — перетягни їх у категорію.

## Запуск

```bash
cd C:\Users\Makar\Projects\finly
npm install
npm run api
```

В іншому терміналі:

```bash
npm run mobile
```

Скопіюй `apps/api/.env.example` → `apps/api/.env` і додай `GC_SECRET_ID` / `GC_SECRET_KEY` з [GoCardless Bank Account Data](https://bankaccountdata.gocardless.com/). Без ключів додаток працює з демо-зарплатою і демо-списаннями.

На фізичному телефоні в «Ще» постав URL API на IP комп’ютера, наприклад `http://192.168.1.10:3001`. Для Android-емулятора за замовчуванням `http://10.0.2.2:3001`.
