from flask import Flask, request, jsonify, render_template, redirect, url_for, flash
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime, date
from sqlalchemy import func

app = Flask(__name__)
CORS(app)

# Secret key for session management
app.config['SECRET_KEY'] = 'your_secret_key'

# Database config
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Database models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(10))  # 'income' or 'expense'
    amount = db.Column(db.Float)
    category = db.Column(db.String(50))
    date = db.Column(db.Date, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', back_populates='transactions')

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50))
    limit_amount = db.Column(db.Float)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', back_populates='budgets')

User.transactions = db.relationship('Transaction', back_populates='user')
User.budgets = db.relationship('Budget', back_populates='user')

# Initialize DB if not exists
with app.app_context():
    db.create_all()

# User loader
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Route to Home page (dashboard)
@app.route('/')
@login_required
def home():
    return render_template('index.html')

# User sign-up route
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

        new_user = User(username=username, password=hashed_password)

        try:
            db.session.add(new_user)
            db.session.commit()
            flash('Account created!', 'success')
            return redirect(url_for('login'))
        except:
            flash('Username already exists', 'danger')
            return redirect(url_for('signup'))

    return render_template('signup.html')

# User login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()

        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('home'))
        else:
            flash('Login Unsuccessful. Please check username and password', 'danger')

    return render_template('login.html')

# User logout route
@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))

# Get all transactions for the current user
@app.route('/transactions', methods=['GET'])
@login_required
def get_transactions():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
    return jsonify([{
        'id': t.id, 'type': t.type, 'amount': t.amount, 
        'category': t.category, 'date': t.date.strftime('%Y-%m-%d')
    } for t in transactions])

# Add new transaction
@app.route('/transactions', methods=['POST'])
@login_required
def add_transaction():
    data = request.get_json()

    # Validate required fields
    if not all(key in data for key in ('type', 'amount', 'category', 'date')):
        return jsonify({'message': 'Missing required fields'}), 400

    try:
        transaction = Transaction(
            type=data['type'],
            amount=data['amount'],
            category=data['category'],
            date=datetime.strptime(data['date'], '%Y-%m-%d'),
            user_id=current_user.id
        )

        db.session.add(transaction)
        db.session.commit()
        flash('Transaction added successfully!', 'success')
        return jsonify({'message': 'Transaction added successfully'})
    
    except Exception as e:
        db.session.rollback()
        flash(f'Error adding transaction: {str(e)}', 'danger')
        return jsonify({'message': 'An error occurred while adding the transaction'}), 500

# Get budget status per category for the current user
@app.route('/budget-status', methods=['GET'])
@login_required
def budget_status():
    budgets = Budget.query.filter_by(user_id=current_user.id).all()
    results = []
    for b in budgets:
        spent = db.session.query(func.sum(Transaction.amount))\
                 .filter_by(type='expense', category=b.category, user_id=current_user.id).scalar() or 0
        remaining = b.limit_amount - spent
        results.append({
            'category': b.category,
            'limit': b.limit_amount,
            'spent': spent,
            'remaining': remaining
        })
    return jsonify(results)

# Predictive Spending Alert
@app.route('/predict-alerts', methods=['GET'])
@login_required
def predict_alerts():
    today = date.today()
    days_in_month = 30  # for simplicity
    day_of_month = today.day

    total_expense = db.session.query(func.sum(Transaction.amount))\
                     .filter_by(type='expense', user_id=current_user.id).scalar() or 0

    avg_daily_expense = total_expense / day_of_month if day_of_month else 0
    predicted_month_expense = avg_daily_expense * days_in_month

    message = "You're on track." if predicted_month_expense <= 50000 else "⚠️ Warning: You may exceed your monthly limit!"

    return jsonify({
        'total_spent': total_expense,
        'average_daily_expense': round(avg_daily_expense, 2),
        'predicted_month_expense': round(predicted_month_expense, 2),
        'message': message
    })

if __name__ == '__main__':
    app.run(debug=True)
