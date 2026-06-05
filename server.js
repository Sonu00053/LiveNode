const express = require('express');
const app = express();

const routes = require('./routes');

app.use('/', routes);

// Home route
app.get('/', (req, res) => {
    res.send('🚀 LiveNode Server is Running Successfully');
});

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));


// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});