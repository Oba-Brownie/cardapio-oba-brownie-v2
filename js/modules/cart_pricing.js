function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function calculateCartLinePricing(cart = [], subtotal = null) {
    const orderSubtotal = subtotal === null
        ? cart.reduce((sum, item) => sum + (safeNumber(item.price) * safeNumber(item.quantity)), 0)
        : subtotal;

    return cart.map(item => {
        const promotion = item.promotion;
        const eligible = Boolean(promotion) && orderSubtotal >= safeNumber(promotion.valor_minimo);
        const percentage = eligible ? safeNumber(promotion.desconto_percentual) : 0;
        const unitPrice = Math.round(safeNumber(item.price) * (1 - percentage / 100) * 100) / 100;
        return {
            item,
            unitPrice,
            promotionApplied: eligible,
            promotionDiscount: Math.max(0, safeNumber(item.price) - unitPrice) * safeNumber(item.quantity)
        };
    });
}
