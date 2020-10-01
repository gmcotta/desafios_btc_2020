require('dotenv').config();

const express = require('express');
const multer = require('multer');

const crypto = require('crypto');
const { extname, resolve } = require('path');
const fs = require('fs');

const { IamAuthenticator } = require('ibm-watson/auth');
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');

// FUNÇÃO DO STT
const getSTTResults = (file, car, res) => {
  const speechToText = new SpeechToTextV1({
    authenticator: new IamAuthenticator({
      apikey: process.env.STT_APIKEY,
    }),
    serviceUrl: process.env.STT_SERVICE_URL,
  });

  const recognizeParams = {
    audio: fs.createReadStream(file),
    contentType: 'audio/flac',
    model: 'pt-BR_NarrowbandModel',
    // model: 'pt-BR_BroadbandModel',
  };

  speechToText.recognize(recognizeParams)
  .then(speechRecognitionResults => {
    let text = '';
    speechRecognitionResults.result.results.forEach(result => {
      result.alternatives.forEach(item => {
        text += `${item.transcript}. `;
      })
    });
    
    fs.unlink(file, err => { return err });

    console.log('Texto: ', text);
    
    getNLUResults(text, car, res);
  })
  .catch(err => { console.log('error:', err) });
}

// APLICAÇÃO DAS REGRAS DE NEGÓCIO
const getRecommendedCar = (entities, car) => {
  const entityPriority = [
    'SEGURANCA', 
    'CONSUMO', 
    'DESEMPENHO', 
    'MANUTENCAO', 
    'CONFORTO', 
    'DESIGN', 
    'ACESSORIOS',
    'MODELO'
  ];

  const entityCarRelationship = {
    SEGURANCA: ['FIAT 500', 'MAREA'], 
    CONSUMO: ['FIORINO', 'TORO'], 
    DESEMPENHO: ['MAREA', 'DUCATO'], 
    MANUTENCAO: ['FIORINO', 'TORO'], 
    CONFORTO: ['CRONOS', 'LINEA'], 
    DESIGN: ['FIAT 500', 'CRONOS'], 
    ACESSORIOS: ['TORO', 'RENEGADE'],
    MODELO: [''],
  }

  let recommendation = '';
  let worstEntities = [];
  let worstEntity = {};

  if (car === '') {
    return recommendation;
  }

  // verificar se não tem entidades
  if (entities.length === 0) {
    return recommendation;
  }

  // verificar se a soma dos valores de sentimento é positiva
  const sentimentSum = entities.reduce((acc, current) => {
    return acc += current.sentiment;
  }, 0);
  console.log('Soma dos sentimentos: ', sentimentSum);

  if (sentimentSum > 0) {
    return recommendation;
  }

  // ordenar as entidades do pior pro melhor sentimento
  let sortedEntities = entities.sort((prev, current) => {
    return prev.sentiment - current.sentiment;
  });

  // retirar a entidade modelo da lista de entidades
  sortedEntities = sortedEntities.filter(data => data.entity !== 'MODELO');

  // verificar se a pior entidade possui valor positivo
  if (sortedEntities[0].sentiment > 0) {
    return recommendation;
  }
  console.log(sortedEntities);

   // verificar se tem mais entidades com valor de sentimento próximo
  for (entity of sortedEntities) {
    if (Math.abs(entity.sentiment - sortedEntities[0].sentiment).toFixed(4) < 0.1) {
      worstEntities.push(entity);
    }
  }
  worstEntity = worstEntities[0];

  // se tiver mais de uma entidade, verificar a prioridade
  if (worstEntities.length > 1) {
    worstEntity = worstEntities.reduce((previous, current) => {
      const priorityNumberPrevious = entityPriority.indexOf(previous.entity);
      const priorityNumberCurrent = entityPriority.indexOf(current.entity);
      return (priorityNumberPrevious < priorityNumberCurrent)
        ? previous 
        : current;
    });
  }

  console.log('Pior entidade: ', worstEntity.entity);

  // obtém o carro recomendado
  recommendation = entityCarRelationship[worstEntity.entity][0];
  if (recommendation === car.toUpperCase() || recommendation.includes(car)) {
    recommendation = entityCarRelationship[worstEntity.entity][1];
  }
  console.log('Carro recomendado: ', recommendation, `${entityCarRelationship[worstEntity.entity].indexOf(recommendation) + 1}º lugar`);
  return recommendation;
}

// TESTE DAS REGRAS DE NEGÓCIO
const testRecommendation = (car, res) => {
  const entities = [
    {
      "entity": "SEGURANCA",
      "sentiment": -0.208772,
      "mention": "consumo dele é muito alto"
    },
    {
      "entity": "CONSUMO",
      "sentiment": -0.208772,
      "mention": "peças de reposição são baratas"
    },
    {
      "entity": "DESEMPENHO",
      "sentiment": -0.248772,
      "mention": "bastante acessórios"
    },
    {
      "entity": "MANUTENCAO",
      "sentiment": -0.388772,
      "mention": "plástico dele é de baixa qualidade"
    },
    {
      "entity": "CONFORTO",
      "sentiment": -0.308772,
      "mention": "plástico dele é de baixa qualidade"
    },
    {
      "entity": "DESIGN",
      "sentiment": 0.358772,
      "mention": "plástico dele é de baixa qualidade"
    },
    {
      "entity": "ACESSORIOS",
      "sentiment": 0.308772,
      "mention": "plástico dele é de baixa qualidade"
    },
    {
      "entity": "MODELO",
      "sentiment": -0.908772,
      "mention": "plástico dele é de baixa qualidade"
    },
    ]

    const recommendation = getRecommendedCar(entities, car);
    

    return res.json({ ok: true });
    // return recommendation;
}

// FUNÇÃO DO NLU
const getNLUResults = (text, car, res) => {
  const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
    version: '2020-08-01',
    authenticator: new IamAuthenticator({
      apikey: process.env.NLU_APIKEY,
    }),
    serviceUrl: process.env.NLU_SERVICE_URL,
  });

  const analyzeParams = {
    text,
    features: {
      sentiment: {},
      entities: {
        model: process.env.WKS_MODEL_ID,
        sentiment: true,
      },
    }
  };

  naturalLanguageUnderstanding.analyze(analyzeParams)
    .then(analysisResults => {
      console.log(JSON.stringify(analysisResults, null, 2));
      const rawEntities = analysisResults.result.entities;
      const entities = rawEntities.map(item => ({
        entity: item.type,
        sentiment: item.sentiment.score,
        mention: item.text,
        }));

      const recommendation = getRecommendedCar(entities, car);
      return res.json({
        recommendation,
        entities
      });

    })
    .catch(err => {
      console.log('error:', err);
    });
}

// CONFIGURAÇÃO DO MULTER
const upload = multer({
  storage: multer.diskStorage({
    destination: resolve(__dirname, 'uploads'),
    filename: (req, file, cb) => {
      crypto.randomBytes(16, (err, res) => {
        if (err) return cb(err);
        return cb(null, res.toString('hex') + extname(file.originalname));
      });
    }
  })
});

// CÓDIGO DO EXPRESS
const app = express();
app.use(express.json());

app.post('/', upload.single('audio'), (req, res) => {
  const { car, text } = req.body;

  if (car === undefined) {
    return res.status(400).json(
      { error: 'Está faltando o carro.' }
    );
  }

  if (req.file && text) {
    return res.status(400).json(
      { error: 'Não pode ter áudio e texto na mesma requisição.' }
    );
  }
  
  if (req.file !== undefined) {
    console.log('Tenho áudio');
    const file = resolve(__dirname, 'uploads', req.file.filename);
    getSTTResults(file, car, res);
    
  } else if (text !== undefined) {
    console.log('Tenho texto');
    getNLUResults(text, car, res);
    // testRecommendation(car, res);
  } else {
    return res.status(400).json(
      { error: 'Está faltando o texto.' }
    );
  }
});

app.listen(8080);
