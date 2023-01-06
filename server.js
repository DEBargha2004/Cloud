require('dotenv').config()
const express = require('express')
const upload = require('express-fileupload')
const ejs = require('ejs');
const bp = require('body-parser')
const bcrypt = require('bcrypt')
const mysql = require('mysql2');
const fileUpload = require('express-fileupload');
const fs = require('fs')
const cookieParser = require('cookie-parser')
const crypto = require('crypto');
const formatOf = require('./function_module/functions.js')
const ex = express()

ex.use(cookieParser())
ex.use(bp.urlencoded({ extended: true }))
ex.set('view engine', 'ejs')
ex.use(express.static('public'))
ex.use(fileUpload())


const connection = mysql.createPool({
    host: process.env.host,
    user: process.env.user,
    database: process.env.database,
    password: process.env.password
})


const saltRounds = 10


ex.listen(3000, () => {
    console.log('Running at port 3000');
})

ex.get('/',(req,res)=>{
    res.redirect('/login')
})

ex.get('/signup', (req, res) => {
    res.render('signup')
})
ex.get('/login', (req, res) => {
    let Cookie = req.cookies
    if(Object.keys(Cookie).length){
        connection.query('select * from cookieinfo where cookie_code = ?',[Cookie.secret],(err,result)=>{
            if(!result.length){
                res.json({
                    message: 'There is some problem in cookie, try to delete the cookie from this site'
                })
            }else{
                var id = result[0]['id']
                res.redirect(`/content?id=${id}`)
            }
        })
    }else{
        res.render('login')
    }
})
ex.get('/update', (req, res) => {
    res.render('update')
})

ex.post('/signup', (req, res) => {
    const p = req.body
    connection.query('select * from userinfo where user_name = ?', [p.user_name], (err, results) => {
        console.log(results);
        if (results.length == 0) {
            bcrypt.hash(p.password, saltRounds, (err, hashedpass) => {
                if (err) {
                    console.error(err)
                } else {
                    connection.query('insert into userinfo values (?,?,?,?,?,?,?)', [null, p.first_name, p.last_name, p.phone_num, p.email_id, p.user_name, hashedpass])
                    res.redirect('/login')
                }
            })
        } else {
            res.send('Please choose a different username')
        }
    })
})


ex.post('/login', (req, res) => {
    var uuid = crypto.randomUUID()
    const p = req.body
    connection.query('select * from userinfo where user_name = ?', [p.user_name], (err, results) => {
        if (results.length == 0) {
            res.send('This Username Doesnot exists')
        } else {
            var userID = results[0]['id']
            const passinfo = results[0]['password']
            bcrypt.compare(p.password, passinfo, (err, result) => {
                if (result == true) {
                    res.cookie('secret',`${uuid}`,{
                        maxAge:1000*60*60*24
                    })
                    connection.query('insert into cookieinfo values(?,?)',[userID,uuid],(err,result)=>{
                        if(err){
                            console.log(err)
                            res.json({
                                message : 'There is a problem, please try later'
                            })
                        }else{
                            res.redirect(`/content?id=${userID}`)
                        }
                    })
                } else {
                    res.send('Please provide a valid password')
                }
            })
        }
    })
})


ex.get('/content', (req, res) => {
        let Cookie = req.cookies
        var userID = req.query.id
        if(Object.keys(Cookie).length){
            if (!userID) {
                res.send('Id not given')
            }else{
                connection.query('select id from cookieinfo where cookie_code = ?',[Cookie.secret],(err,result)=>{
                    if (err) {
                        res.json({
                            message: 'There is some problem in authentication'
                        })
                    } else {
                        if(result.length){
                            if(result[0]['id'] == userID){
                                connection.query('select * from parcel where user_id=?', [userID], (err, parcel_results) => {
                                    connection.query('select * from userinfo where id = ?',[userID],(err,user_results)=>{
                                        res.render('content', { parcel_data: parcel_results,user_data:user_results })
                                    })
                                    
                                })
                            }else{
                                res.json({
                                    message:'Try to re-login'
                                })
                            }
                        }else{
                            res.json({
                                message: 'This is Id is not authenticated, please try to re-login'
                            })
                        }
                    }
                })
            }
        }else{
            res.redirect('/login')
        }
    }
)

ex.post('/savecontent', (req, res) => {

        const cookie = req.cookies.secret
        const file = req.files.userfile
        var fileFormat = formatOf(file.mimetype)
        if(fileFormat == 'octet-stream'){
            fileFormat = 'mp4'
        }
        var code_name = file.md5
        const filename = file.name.replace(/ /g,'')
        var code_path = code_name+'.'+fileFormat
        file.mv('public/userfile/' + code_path)

        connection.query('select * from cookieinfo where cookie_code=?',[cookie],(err,result)=>{
            var id = result[0]['id']
            connection.query('insert into parcel values(?,?,?,?)', [null, id, filename, code_path], (err) => {
                if (err) {
                    console.error(err);
                } else {
                    res.redirect('/login')
                }
            })
        })
})

ex.post('/download',(req,res)=>{
    path = req.body.image
    res.download(`${__dirname}/public/userfile/${path}`)
})

ex.get('/logout',(req,res)=>{
    res.clearCookie('secret')
    res.redirect('/')
})