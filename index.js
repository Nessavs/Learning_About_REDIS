const express = require('express')
const redis = require('redis')
const mongoose = require('mongoose')
const path = require('path')

const app = express()

app.use(express.json())

const redisClient = redis.createClient()
redisClient.on('error', (err) => console.log('Redis Error', err))

mongoose.connect('mongodb://localhost:27017/loja_teste')
  .then(() => console.log('🍃 MongoDB Conectado!'))
  .catch(err => console.error('Erro Mongo:', err))

const ProdutoSchema = new mongoose.Schema({
  nome: String,
  preco: Number,
  descricao: String
})
const Produto = mongoose.model('Produto', ProdutoSchema)

async function seedDatabase() {
  const count = await Produto.countDocuments()
  if (count === 0) {
    console.log('🌱 Banco vazio! Criando 5.000 produtos falsos (aguarde)...')
    const produtosFalsos = []
    for (let i = 0; i < 5000; i++) {
      produtosFalsos.push({
        nome: `Produto Gamer ${i}`,
        preco: Math.random() * 1000,
        descricao: `Descrição detalhada do produto ${i} para ocupar espaço na memória`
      })
    }
    await Produto.insertMany(produtosFalsos)
    console.log('✅ 5.000 Produtos criados!')
  } else {
    console.log(`-> O banco já tem ${count} produtos.`)
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})


app.get('/produtos', async (req, res) => {
  const key = 'todos_os_produtos'
  const inicio = Date.now()

  const cache = await redisClient.get(key)

  if (cache) {
    console.log(`⚡ REDIS (HIT): ${Date.now() - inicio}ms`)
    return res.json(JSON.parse(cache))
  }

  console.log('🐌 MONGODB (MISS): Buscando...')
  const dados = await Produto.find().sort({ _id: -1 })

  // Salva no Redis com TTL de 60 segundos
  await redisClient.set(key, JSON.stringify(dados), { EX: 60 })

  console.log(`🐢 MONGODB (MISS): ${Date.now() - inicio}ms`)
  return res.json(dados)
})

app.post('/produtos', async (req, res) => {
  try {
    const novo = await Produto.create(req.body)

    // Invalida o cache (remove a chave)
    await redisClient.del('todos_os_produtos')

    console.log('🗑️  CACHE INVALIDADO (DEL key)')
    res.json(novo)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Inicialização dos serviços
const start = async () => {
  await redisClient.connect()
  await seedDatabase()
  app.listen(3000, () => console.log('🚀 Painel: http://localhost:3000'))
}
start()

// --- FUNCIONALIDADE 100% REDIS (SEM MONGODB) ---

app.post('/carrinho', async (req, res) => {
    const { idUsuario, produto } = req.body
    const key = `carrinho:${idUsuario}`

    const item = {
        produto: produto,
        adicionadoEm: new Date()
    }

    // Salva no Redis com TTL de 5 minutos (300s)
    await redisClient.set(key, JSON.stringify(item), { EX: 300 })

    console.log('🛒 Item salvo APENAS no Redis (Sem Mongo)')
    res.json({ mensagem: "Item no carrinho (Dura 5 min)", item })
})

// 2. Ler Carrinho
app.get('/carrinho/:idUsuario', async (req, res) => {
    const key = `carrinho:${req.params.idUsuario}`
    
    const carrinho = await redisClient.get(key)
    
    if (carrinho) {
        console.log(`🛒 REDIS: Recuperei o carrinho de ${req.params.idUsuario}`)
        return res.json(JSON.parse(carrinho))
    } else {
        console.log(`💨 REDIS: O carrinho de ${req.params.idUsuario} expirou ou não existe.`)
        return res.json({ mensagem: "Carrinho vazio ou expirado!" })
    }
})
