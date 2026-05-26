document.addEventListener('DOMContentLoaded', () => {
  const productsContainer = document.getElementById('products-container');
  const addProductBtn = document.getElementById('add-product-btn');
  const calculateBtn = document.getElementById('calculate-btn');
  const resultsSection = document.getElementById('results-section');
  const productTemplate = document.getElementById('product-template');
  
  let productCount = 0;
  let breakEvenChartInstance = null;

  // Add initial product
  addProduct();

  addProductBtn.addEventListener('click', addProduct);
  
  calculateBtn.addEventListener('click', calculateBreakEven);

  function addProduct() {
    productCount++;
    const clone = productTemplate.content.cloneNode(true);
    const productItem = clone.querySelector('.product-item');
    
    // Update title
    clone.querySelector('.product-title').textContent = `Producto ${productCount}`;
    
    // Default values based on the image example for testing (A, B, C)
    const nameInput = clone.querySelector('.prod-name');
    const priceInput = clone.querySelector('.prod-price');
    const costInput = clone.querySelector('.prod-cost');
    const demandInput = clone.querySelector('.prod-demand');

    if (productCount === 1) {
      nameInput.value = 'A';
      priceInput.value = '22.00';
      costInput.value = '9.00';
      demandInput.value = '110'; // Using first month
    } else if (productCount === 2) {
      nameInput.value = 'B';
      priceInput.value = '17.00';
      costInput.value = '7.50';
      demandInput.value = '75';
    } else if (productCount === 3) {
      nameInput.value = 'C';
      priceInput.value = '12.00';
      costInput.value = '6.75';
      demandInput.value = '40';
    }
    
    // Setup remove button
    const removeBtn = clone.querySelector('.remove-product');
    removeBtn.addEventListener('click', () => {
      productItem.remove();
      updateProductTitles();
    });

    productsContainer.appendChild(clone);
  }

  function updateProductTitles() {
    const items = productsContainer.querySelectorAll('.product-item');
    productCount = 0;
    items.forEach((item) => {
      productCount++;
      item.querySelector('.product-title').textContent = `Producto ${productCount}`;
    });
  }

  function calculateBreakEven() {
    const fixedCostsInput = document.getElementById('fixed-costs').value;
    const cf = parseFloat(fixedCostsInput);
    
    if (isNaN(cf) || cf < 0) {
      alert("Por favor ingrese un valor válido para los Costos Fijos.");
      return;
    }

    const productElements = productsContainer.querySelectorAll('.product-item');
    if (productElements.length === 0) {
      alert("Por favor agregue al menos un producto.");
      return;
    }

    const products = [];
    let totalDemand = 0;
    let expectedTotalRevenue = 0;
    let expectedTotalVarCost = 0;

    // Gather data
    let valid = true;
    productElements.forEach(el => {
      const name = el.querySelector('.prod-name').value || 'Sin nombre';
      const price = parseFloat(el.querySelector('.prod-price').value);
      const cost = parseFloat(el.querySelector('.prod-cost').value);
      const demand = parseFloat(el.querySelector('.prod-demand').value);

      if (isNaN(price) || isNaN(cost) || isNaN(demand)) {
        valid = false;
        return;
      }

      products.push({ name, price, cost, demand });
      totalDemand += demand;
      expectedTotalRevenue += price * demand;
      expectedTotalVarCost += cost * demand;
    });

    if (!valid) {
      alert("Por favor complete todos los campos de los productos con números válidos.");
      return;
    }

    if (totalDemand === 0) {
      alert("La demanda total no puede ser cero.");
      return;
    }

    // Calculations
    let mcptTotal = 0;

    products.forEach(p => {
      p.participation = p.demand / totalDemand;
      p.mcu = p.price - p.cost;
      p.mcp = p.mcu * p.participation;
      mcptTotal += p.mcp;
    });

    if (mcptTotal <= 0) {
      alert("El Margen de Contribución Ponderado Total debe ser mayor a 0 para calcular el punto de equilibrio.");
      return;
    }

    const qeGlobalUnits = cf / mcptTotal;
    let globalEquilibriumRevenue = 0;

    products.forEach(p => {
      p.qeUnits = qeGlobalUnits * p.participation;
      p.equilibriumRevenue = p.qeUnits * p.price;
      globalEquilibriumRevenue += p.equilibriumRevenue;
    });

    const expectedProfit = expectedTotalRevenue - (expectedTotalVarCost + cf);

    // Update UI
    document.getElementById('global-qe-units').textContent = formatNumber(qeGlobalUnits) + " un.";
    document.getElementById('global-qe-revenue').textContent = formatCurrency(globalEquilibriumRevenue);
    
    const profitEl = document.getElementById('expected-profit');
    profitEl.textContent = formatCurrency(expectedProfit);
    if (expectedProfit < 0) {
      profitEl.style.color = 'var(--danger)';
    } else {
      profitEl.style.color = ''; // Reset to default or use a success color
    }

    // Update Table
    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td>${formatNumber(p.demand)}</td>
        <td>${(p.participation * 100).toFixed(2)}%</td>
        <td>${formatCurrency(p.mcu)}</td>
        <td>${formatCurrency(p.mcp)}</td>
        <td>${formatNumber(p.qeUnits)}</td>
        <td>${formatCurrency(p.equilibriumRevenue)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Totals row in tfoot
    const tfoot = document.getElementById('results-tfoot');
    tfoot.innerHTML = `
      <tr>
        <td><strong>Total</strong></td>
        <td>${formatNumber(totalDemand)}</td>
        <td>100.00%</td>
        <td>-</td>
        <td>${formatCurrency(mcptTotal)}</td>
        <td>${formatNumber(qeGlobalUnits)}</td>
        <td>${formatCurrency(globalEquilibriumRevenue)}</td>
      </tr>
    `;

    drawChart(products, cf, totalDemand, qeGlobalUnits);

    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  function drawChart(products, cf, totalDemand, qeGlobalUnits) {
    if (breakEvenChartInstance) {
      breakEvenChartInstance.destroy();
    }

    const labels = [];
    const ingresosData = [];
    const costosData = [];

    // Calculate weighted prices and costs
    let pvPonderado = 0;
    let cvPonderado = 0;
    products.forEach(p => {
      pvPonderado += p.price * p.participation;
      cvPonderado += p.cost * p.participation;
    });

    const maxQ = Math.max(totalDemand * 1.5, qeGlobalUnits * 2);
    const step = maxQ / 10;

    for (let i = 0; i <= 10; i++) {
      const q = i * step;
      labels.push(formatNumber(q));
      ingresosData.push(q * pvPonderado);
      costosData.push(cf + q * cvPonderado);
    }

    const ctx = document.getElementById('breakEvenChart').getContext('2d');
    breakEvenChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ingreso Total',
            data: ingresosData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1
          },
          {
            label: 'Costo Total',
            data: costosData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Gráfico de Punto de Equilibrio Global',
            color: '#f8fafc',
            font: { size: 16, family: 'Inter' }
          },
          legend: {
            labels: { color: '#f8fafc', font: { family: 'Inter' } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += formatCurrency(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Unidades Ponderadas (Q)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            title: { display: true, text: 'Monto ($)', color: '#94a3b8' },
            ticks: { 
              color: '#94a3b8',
              callback: function(value) {
                return '$' + value;
              }
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('es-US', { maximumFractionDigits: 2 }).format(value);
  }
});
