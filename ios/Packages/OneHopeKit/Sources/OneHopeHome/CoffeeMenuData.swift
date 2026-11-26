import Foundation

/// Revival Coffee's menu as printed on myrevivalcoffee.com/menu on Nov 19, 2026.
struct MenuLine: Identifiable {
    let name: String
    let detail: String
    let price: String

    var id: String {
        name
    }
}

enum CoffeeMenuData {
    static let drinks: [MenuLine] = [
        MenuLine(name: "Espresso", detail: "Bold, rich single or double shot", price: "$3.50"),
        MenuLine(name: "Americano", detail: "Espresso with hot water", price: "$4.00"),
        MenuLine(name: "Latte", detail: "Espresso with steamed milk and a touch of foam", price: "$5.00"),
        MenuLine(name: "Cappuccino", detail: "Equal parts espresso, steamed milk, and foam", price: "$5.00"),
        MenuLine(name: "Cold Brew", detail: "Slow-steeped for 18 hours", price: "$5.00"),
        MenuLine(name: "Iced Latte", detail: "Espresso over ice with cold milk", price: "$5.50"),
        MenuLine(name: "Mocha", detail: "Espresso, chocolate, and steamed milk", price: "$5.50"),
        MenuLine(name: "Flat White", detail: "Microfoam over a double shot", price: "$5.00"),
        MenuLine(name: "Macchiato", detail: "Espresso marked with foam", price: "$4.00"),
        MenuLine(name: "Drip Coffee", detail: "Freshly brewed house blend", price: "$3.00"),
    ]

    static let food: [MenuLine] = [
        MenuLine(name: "Breakfast Sandwich", detail: "Egg, cheese, and protein on brioche", price: "$7.00"),
        MenuLine(name: "Avocado Feta Toast", detail: "Sourdough, tomatoes, feta, walnuts. Add egg $1.", price: "$10.00"),
        MenuLine(name: "Overnight Oats Chia Pudding", detail: "Blueberry or strawberry. The menu lists no price.", price: "Ask"),
        MenuLine(name: "Yogurt Parfait", detail: "Greek yogurt, granola, and fruit", price: "$6.00"),
        MenuLine(name: "Three Cheese Grilled Cheese", detail: "Cheddar, fontina, and Gruyère. Kettle chips.", price: "$10.00"),
        MenuLine(name: "Tomato Mozzarella Sandwich", detail: "Pesto and mozzarella on focaccia. Kettle chips.", price: "$10.00"),
        MenuLine(name: "Chicken Pesto Wrap", detail: "Chicken, pesto, and avocado. Kettle chips.", price: "$10.00"),
        MenuLine(name: "Turkey Club Wrap", detail: "Turkey, bacon, lettuce, tomato, and ranch", price: "$9.00"),
        MenuLine(name: "Fresh Pastries", detail: "Croissants, muffins, and scones", price: "$4.00"),
    ]
}
