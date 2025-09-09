const express = require ('express');
const users = require ("./sample.json");

const app=express();
const port=8000;

//Display all users
app.get("/users",(req,res) =>{
   return res.json(users);
});

app.listen(port, (err) => {
    console.log(`app is running in port ${port}`);
})