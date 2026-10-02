//
//  HabbitWidgetBundle.swift
//  HabbitWidget
//
//  Created by charlie on 4/20/26.
//

import WidgetKit
import SwiftUI

@main
struct HabbitWidgetBundle: WidgetBundle {
    var body: some Widget {
        HabbitWidget()
        HabitsWidget()
        BudgetWidget()
    }
}
