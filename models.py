from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(10))  # 'income' or 'expense'
    amount = db.Column(db.Float)
    category = db.Column(db.String(50))
    date = db.Column(db.Date, default=datetime.utcnow)

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50))
    limit_amount = db.Column(db.Float)
