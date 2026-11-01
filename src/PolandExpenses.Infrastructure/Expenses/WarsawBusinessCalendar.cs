using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.Infrastructure.Expenses;

internal sealed class WarsawBusinessCalendar(TimeProvider timeProvider) : IBusinessCalendar
{
    private static readonly TimeZoneInfo BusinessTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), BusinessTimeZone).DateTime);
}
