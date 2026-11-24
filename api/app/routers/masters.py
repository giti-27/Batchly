from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from api.app.db import get_db
from api.app.models.entities import Item, Product, Customer, Supplier, BOM, BOMLine, AppSettings, User
from api.app.schemas.schemas import (
    ItemCreate, ItemResponse, ProductCreate, ProductResponse,
    CustomerCreate, CustomerResponse, SupplierCreate, SupplierResponse
)
from api.app.services.auth_service import get_current_user, require_role

router = APIRouter(tags=["Masters"])

# ITEMS
@router.get("/items", response_model=List[ItemResponse])
def list_items(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Item).filter(Item.is_active == True).all()

@router.post("/items", response_model=ItemResponse)
def create_item(req: ItemCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    item = Item(**req.model_dump(), created_by=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

# PRODUCTS
@router.get("/products", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Product).filter(Product.is_active == True).all()

@router.post("/products", response_model=ProductResponse)
def create_product(req: ProductCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    prod = Product(**req.model_dump())
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

# CUSTOMERS
@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Salesman sees assigned customers only!
    if user.role == "SALESMAN":
        return db.query(Customer).filter(
            Customer.is_active == True,
            Customer.assigned_salesman_id == user.id
        ).all()
    return db.query(Customer).filter(Customer.is_active == True).all()

@router.post("/customers", response_model=CustomerResponse)
def create_customer(req: CustomerCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    cust = Customer(**req.model_dump())
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust

# SUPPLIERS
@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Supplier).filter(Supplier.is_active == True).all()

@router.post("/suppliers", response_model=SupplierResponse)
def create_supplier(req: SupplierCreate, db: Session = Depends(get_db), user: User = Depends(require_role(["ADMIN"]))):
    supp = Supplier(**req.model_dump())
    db.add(supp)
    db.commit()
    db.refresh(supp)
    return supp

# SETTINGS
@router.get("/settings")
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(AppSettings).first()
