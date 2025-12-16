const express = require('express');
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('layout', {
        title: 'Air Quality Ghana',
        body: `
            <h1>Air Quality Ghana</h1>
            <p>De server draait correct 🎉<br>
            Dit is de homepage van het Air Quality Ghana project.</p>
        `
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server draait op http://localhost:${PORT}`);
});