const { v4: uuidv4 } = require('uuid');

class OperationManager {
  constructor() {
    this.operations = new Map();
  }

  create({ type, provider, metadata = {} }) {
    const id = uuidv4();

    const operation = {
      id,
      type,
      provider,
      status: 'pending',
      metadata,
      result: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.operations.set(id, operation);
    return operation;
  }

  update(id, updates) {
    const op = this.operations.get(id);
    if (!op) return;

    Object.assign(op, updates);
    op.updatedAt = new Date();
  }

  get(id) {
    return this.operations.get(id);
  }

  cleanup(ttlMs = 3600000) {
    const now = Date.now();

    for (const [id, op] of this.operations.entries()) {
      if (now - new Date(op.updatedAt).getTime() > ttlMs) {
        this.operations.delete(id);
      }
    }
  }
}

module.exports = new OperationManager();
