import express from 'express';

const app = express();
const Port = 8000;

// http://localhost:8000
app.get('/', (req,res) => {
    res.send({message: 'server is working'})
})
app.listen(Port, () =>{
    console.log(`server is running at ${Port}`);
})