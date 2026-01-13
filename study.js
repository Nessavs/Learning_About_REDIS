const redis = require('redis')
const client = redis.createClient()
await client.connect()

async function getProducts(req, res) {
	const key = 'productsList'

	const cacheProducts = await client.get(key)
	if (cacheProducts) {
		console.log('Serving from cache')
		return res.json(JSON.parse(cacheProducts))
	}

	console.log('Fetching from database')
	const productsFromDB = await Database.findAll('products');

	await client.set(key, JSON.stringify(productsFromDB), { EX: 3600 })

	return res.json(productsFromDB)
}

getProducts()

//TTL (Time To Live): Define um tempo de vida (ex: 1 hora)
//Expulsão Explícita: Quando houver um POST, PUT ou DELETE no banco, o código deve apagar a chave no Redis

async function putProducts(id, dados) {
    await Database.update('products', id, dados) // Atualiza no banco
    await client.del('productsList') // Remove o cache antigo forçando uma nova busca na próxima leitura
}

putProducts(1, { name: 'New Product', price: 99.99 })

//a variável redisClient é a, digamos, "variável universal" da conexão com o Redis.
//É ela que guarda os "poderes" para falar com o banco de memória. 
// Sempre que você vê redisClient.get (ler), redisClient.set (salvar) ou redisClient.del (apagar), 
// é através dessa instância que o Node.js envia os comandos para o servidor Redis.

//const redis = require('redis')
//const redisClient = redis.createClient()
//>>> Aqui é onde a conexão é efetivamente configurada (por padrão no localhost:6379).

// conceitos como Cache, TTL (Time To Live) e Invalidation são lógicas de negócio que confirmam que você está usando o Redis para performance, não apenas como banco de dados.

//exemplo:
//Economia: Imagine se a Amazon salvasse no Banco de Dados cada vez que um curioso clica em "Adicionar ao Carrinho" e depois sai do site. 
// O banco ficaria gigante com lixo. Por isso usa-se o Redis: é rápido e se o cliente sumir, o dado some junto.
//Performance: Em sites com muitos acessos, ler do banco de dados a cada requisição pode ser lento e custoso.
// Usando o Redis como cache, você alivia a carga do banco e entrega respostas rápidas aos usuários.