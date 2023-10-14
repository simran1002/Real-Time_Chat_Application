const express = require('express');
const app = express();
const port = 8000;


app.get('/', (req, res) => {
    res.send('Hii, I am here to chat with you!!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});