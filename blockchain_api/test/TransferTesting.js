const SimpleTransfer = artifacts.require("WarehouseTransfer");

contract("WarehouseTransfer", (accounts) => {
    let transferInstance;
    
    // Usar direcciones de Ganache
    const [owner, warehouseA, warehouseB, randomUser] = accounts;
    
    // Productos de prueba predefinidos
    const testProducts = [
        { id: 101, name: "Laptop Gaming" },
        { id: 102, name: "Servidor HP" },
        { id: 103, name: "Monitor 4K" },
        { id: 104, name: "Teclado Mecánico" },
        { id: 105, name: "Mouse Inalámbrico" }
    ];
    
    before(async () => {
        transferInstance = await SimpleTransfer.new();
        
        // Inicializar productos en blockchain (simulando data de SQL)
        const productIds = testProducts.map(p => p.id);
        const initialWarehouses = testProducts.map(() => warehouseA); // Todos en Bodega A inicialmente
        
        await transferInstance.initializeProducts(
            productIds, 
            initialWarehouses,
            { from: owner }
        );
        
        console.log("✅ Productos inicializados en blockchain:");
        testProducts.forEach(product => {
            console.log(`   Producto ${product.id}: ${product.name} → Bodega A`);
        });
    });
    
    it("should verify initial ownership in Warehouse A", async () => {
        for (const product of testProducts) {
            const isOwner = await transferInstance.verifyOwnership(product.id, warehouseA);
            assert.isTrue(isOwner, `Producto ${product.id} debería estar en Bodega A inicialmente`);
        }
        console.log("✅ Todos los productos verificados en Bodega A");
    });
    
    it("should transfer product from Warehouse A to Warehouse B", async () => {
        const productId = 101; // Transferir el Laptop Gaming
        
        // Verificar ownership inicial
        let currentWarehouse = await transferInstance.getProductWarehouse(productId);
        assert.equal(currentWarehouse, warehouseA, "Debería empezar en Bodega A");
        
        // TRANSFERIR: Warehouse A → Warehouse B
        await transferInstance.transferProduct(
            productId, 
            warehouseB, 
            { from: warehouseA }
        );
        
        // VERIFICAR nueva ownership
        currentWarehouse = await transferInstance.getProductWarehouse(productId);
        const isOwnerB = await transferInstance.verifyOwnership(productId, warehouseB);
        const isOwnerA = await transferInstance.verifyOwnership(productId, warehouseA);
        
        console.log(`✅ Producto ${productId} transferido de A → B`);
        console.log(`   Bodega actual: ${currentWarehouse}`);
        console.log(`   ¿Bodega B es dueña? ${isOwnerB}`);
        console.log(`   ¿Bodega A todavía es dueña? ${isOwnerA}`);
        
        assert.equal(currentWarehouse, warehouseB, "Debería estar en Bodega B");
        assert.isTrue(isOwnerB, "Bodega B debería ser dueña");
        assert.isFalse(isOwnerA, "Bodega A ya no debería ser dueña");
    });
    
    /*
    it("should transfer multiple products between warehouses", async () => {
        // Transferir varios productos
        const transfers = [
            { productId: 102, from: warehouseA, to: warehouseB },
            { productId: 103, from: warehouseA, to: warehouseC },
            { productId: 104, from: warehouseA, to: warehouseB }
        ];
        
        for (const transfer of transfers) {
            await transferInstance.transferProduct(
                transfer.productId, 
                transfer.to, 
                { from: transfer.from }
            );
            
            const isOwner = await transferInstance.verifyOwnership(transfer.productId, transfer.to);
            assert.isTrue(isOwner, `Producto ${transfer.productId} debería estar en bodega destino`);
            
            console.log(`✅ Producto ${transfer.productId} transferido a ${transfer.to}`);
        }
        
        // Verificar estado final
        const warehouseBProducts = [];
        const warehouseCProducts = [];
        
        for (const product of testProducts.slice(1, 4)) { // Productos 102, 103, 104
            const warehouse = await transferInstance.getProductWarehouse(product.id);
            if (warehouse === warehouseB) warehouseBProducts.push(product.id);
            if (warehouse === warehouseC) warehouseCProducts.push(product.id);
        }
        
        console.log("📦 Productos en Bodega B:", warehouseBProducts);
        console.log("📦 Productos en Bodega C:", warehouseCProducts);
    });*/
    
    it("should prevent unauthorized transfers", async () => {
        const productId = 104; // Mouse Inalámbrico (todavía en Warehouse A)
        
        try {
            // Random user intenta transferir (debería fallar)
            await transferInstance.transferProduct(
                productId, 
                warehouseB, 
                { from: randomUser }
            );
            assert.fail("Should have thrown error");
        } catch (error) {
            assert(error.message.includes("Not the current warehouse owner"), "Debería prevenir transferencia no autorizada");
            console.log("✅ Transferencia no autorizada correctamente bloqueada");
        }
    });
});