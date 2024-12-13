require("dotenv").config();

const config = require("./config.json");
const mongoose = require("mongoose");

mongoose.connect(config.connectionString);

const Users = require("./models/user.model");
const Note = require("./models/note.model");

const express = require("express");
const cors = require("cors");
const app = express();

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

const PORT = 3005;
app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (req, res) => {
  res.json({ data: "Olá" });
});

// BackEnd PRONTO "!!!"

// Rota criar conta
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res
      .status(400)
      .json({ error: true, message: "Nome completo é obrigatório" });
  }

  if (!email) {
    return res
      .status(400)
      .json({ error: true, message: "Email é obrigatório" });
  }

  if (!password) {
    return res
      .status(400)
      .json({ error: true, message: "Crie uma senha, por favor" });
  }

  const isUsers = await Users.findOne({ email: email });

  if (isUsers) {
    return res.json({
      error: true,
      message: "Usuário já existe",
    });
  }

  const users = new Users({
    fullName,
    email,
    password,
  });

  await users.save();

  const accessToken = jwt.sign({ users }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "36000m",
  });

  return res.json({
    error: false,
    users,
    accessToken,
    message: "Registrado com Sucesso",
  });
});

// Rota mostra usuário
app.get("/get-user", authenticateToken, async (req, res) => {
  const { users } = req.users;

  const isUser = await Users.findOne({ _id: users._id });

  if (!isUser) {
    return res.sendStatus(401);
  }

  return res.json({
    users: {
      fullName: isUser.fullName,
      email: isUser.email,
      _id: isUser._id,
      createdOn: isUser.createOn,
    },
    message: "...",
  });
});

// Rota Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email é obrigatório" });
  }

  if (!password) {
    return res.status(400).json({ message: "A senha é obrigatório" });
  }

  const userInfo = await Users.findOne({ email: email });

  if (!userInfo) {
    return res.status(400).json({ message: "Usuário não encontrado!" });
  }

  if (userInfo.email == email && userInfo.password == password) {
    const users = { users: userInfo };
    const accessToken = jwt.sign(users, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "36000m",
    });

    return res.json({
      error: false,
      message: "Login bem sucedido",
      email,
      accessToken,
    });
  } else {
    return res.status(400).json({
      error: true,
      message: "Credenciais inválidas",
    });
  }
});

// Rota Adicionar nota
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { users } = req.users;

  if (!title) {
    return res
      .status(400)
      .json({ error: true, message: "O título é obrigatório" });
  }
  if (!content) {
    return res
      .status(400)
      .json({ error: true, message: "É obrigatório digitar algo no conteúdo" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: users._id,
    });

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Nota adicionada com sucesso",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Error no servidor interno",
    });
  }
});

//Rota para editar nota
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;
  const { users } = req.users;

  if (!title && !content && !tags) {
    return res
      .status(400)
      .json({ error: true, message: "Nenhuma alteração fornecida" });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: users._id });

    if (!note) {
      return res
        .status(404)
        .json({ error: true, message: "Nota não encontrada" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Nota atualizada com sucesso",
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      const validationErros = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        error: true,
        message: "Erro de validação",
        validationErros,
      });
    } else {
      return res.status(500).json({
        error: true,
        message: "Erro no servidor interno",
      });
    }
  }
});

// Rota para mostrar todas as notas
app.get("/get-all-notes", authenticateToken, async (req, res) => {
  const { users } = req.users;

  try {
    const notes = await Note.find({ userId: users._id }).sort({ isPinned: -1 });

    return res.json({
      error: false,
      notes,
      message: "Todas as notas recuperadas com sucesso",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Error no servidor interno",
    });
  }
});

// Rota pra excluir notas
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { users } = req.users;

  try {
    const note = await Note.findOne({ _id: noteId, userId: users._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Nota não encontrada",
      });
    }

    await Note.deleteOne({ _id: noteId, userId: users._id });

    return res.json({
      error: false,
      message: "Nota deletada com sucesso",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Error no servidor interno",
    });
  }
});

// Rota atualizar o valor do isPinned ("fixar✒️")
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  const { users } = req.users;

  try {
    const note = await Note.findOne({ _id: noteId, userId: users._id });

    if (!note) {
      return res
        .status(404)
        .json({ error: true, message: "Nota não encontrada" });
    }

    note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Nota atualizada com sucesso",
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      const validationErros = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        error: true,
        message: "Erro de validação",
        validationErros,
      });
    } else {
      return res.status(500).json({
        error: true,
        message: "Erro no servidor interno",
      });
    }
  }
});

// Rota Pesquisar notas
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { users } = req.users;
  const { query } = req.query;

  if (!query) {
    return res
      .status(400)
      .json({ error: true, message: "Consulta de pesquisa é necessária" });
  }

  try {
    const matchingNotes = await Note.find({
      userId: users._id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
      ],
    });

    return res.json({
      error: false,
      notes: matchingNotes,
      message:
        "Notas correspondentes à consulta de pesquisa recuperadas com sucesso",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Error no servidor Interno",
    });
  }
});

app.listen(3005, () =>
  console.log(`✅ Servidor rodando na porta: -->${PORT}<--✨`)
);

module.exports = app;
