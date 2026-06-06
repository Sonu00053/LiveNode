const express = require('express');
const path = require('path');
const app = express();
const routes = require('./routes');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', routes);
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});