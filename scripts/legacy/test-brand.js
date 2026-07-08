// Test script to verify brand field is working
const API_URL = 'http://192.168.1.5:3000/api';

async function testBrandCreation() {
  console.log('🧪 Testing brand field creation...\n');
  
  const testProduct = {
    company_id: 1, // Измените на ваш company_id
    name: 'Test Brand Product ' + Date.now(),
    quantity: 10,
    price: 100,
    markupPercent: 20,
    barcode: 'TEST123',
    barid: '',
    category: 'Смартфоны',
    description: 'Test product with brand',
    color: 'Red',
    size: 'Medium',
    brand: 'TestBrand123', // ВАЖНО: brand должен быть здесь
    hasColorOptions: false,
    availableForCustomers: true
  };

  console.log('📤 Sending request with data:');
  console.log(JSON.stringify(testProduct, null, 2));
  console.log('');

  try {
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testProduct)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Product created successfully!');
      console.log('Product ID:', result.id);
      
      // Теперь получаем продукт обратно чтобы проверить brand
      const getResponse = await fetch(`${API_URL}/products/${result.id}`);
      const product = await getResponse.json();
      
      console.log('\n📦 Retrieved product:');
      console.log('Name:', product.name);
      console.log('Brand:', product.brand);
      console.log('Color:', product.color);
      console.log('Size:', product.size);
      console.log('\nFull product data:', JSON.stringify(product, null, 2));
      
      if (product.brand === testProduct.brand) {
        console.log('\n🎉 SUCCESS! Brand field is working correctly!');
      } else {
        console.log('\n❌ FAILURE! Brand not saved correctly.');
        console.log('Expected:', testProduct.brand);
        console.log('Got:', product.brand);
      }
    } else {
      console.log('❌ Failed to create product:', result);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testBrandCreation();
