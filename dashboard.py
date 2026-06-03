import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

# =========================
# PAGE CONFIG
# =========================
st.set_page_config(
    page_title="Track Smart Analysis",
    page_icon="💵",
    layout="wide"
)

# =========================
# COLOR PALETTE
# =========================
PRIMARY = "#6e7a73"    # Hijau Tua (Untuk Judul & Tab Aktif)
TEXT_DARK = "#000000"  # Hitam Pekat (Untuk Label & Angka)
BACKGROUND = "#E4E9D3" # Warna Latar Belakang (Light Green)
SIDEBAR_BG = "#cedad9" 
PALETTE = ["#9eb5b3", "#9ea6a2", "#9eb5a8", "#6e7a73", "#cedad9"]

# =========================
# CUSTOM CSS
# =========================
st.markdown(f"""
<style>
    .stApp {{
        background-color: {BACKGROUND};
    }}

    .main-title {{
        font-size: 38px;
        font-weight: 800;
        color: {PRIMARY} !important;
        margin-bottom: 0px;
    }}

    .creator-text {{
        font-size: 16px;
        color: {TEXT_DARK} !important;
        font-weight: 500;
        margin-bottom: 25px;
        opacity: 0.9;
    }}

    [data-testid="stSidebar"] {{
        background-color: {SIDEBAR_BG} !important;
    }}
    [data-testid="stSidebar"] h2, [data-testid="stSidebar"] label p {{
        color: {TEXT_DARK} !important;
        font-weight: 700 !important;
    }}

    .stTabs [data-baseweb="tab"] p {{
        color: {PRIMARY} !important;
        font-weight: 600 !important;
    }}
    .stTabs [aria-selected="true"] p {{
        color: {TEXT_DARK} !important;
        font-weight: 800 !important;
    }}

    .card {{
        background-color: #ffffff;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #dddddd;
        border-top: 6px solid {PRIMARY};
        text-align: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }}
    .card-title {{ color: {PRIMARY} !important; font-weight: bold !important; text-transform: uppercase; }}
    .card-value {{ color: {TEXT_DARK} !important; font-size: 26px !important; font-weight: 800 !important; }}

    .interpretation-box {{
        background-color: rgba(255, 255, 255, 0.7);
        padding: 15px;
        border-radius: 10px;
        border-left: 5px solid {PRIMARY};
        margin-top: 10px;
        margin-bottom: 20px;
        color: {TEXT_DARK} !important;
        font-size: 15px;
        line-height: 1.6;
    }}
</style>
""", unsafe_allow_html=True)

# =========================
# LOAD & FEATURE ENGINEERING
# =========================
@st.cache_data
def load_and_process_data():
    try:
        df = pd.read_csv("data_cleaned.csv")
        df["Date"] = pd.to_datetime(df["Date"])
        df["Year"] = df["Date"].dt.year
        df["Month"] = df["Date"].dt.month
        df["Quarter"] = "Q" + df["Date"].dt.quarter.astype(str)
        df["YearMonth"] = df["Date"].dt.to_period("M").astype(str)
        
        needs_categories = [
            "Transportation", "Food", "Family", "Household", "Health", "Education", 
            "Rent", "Mortgage & Rent", "Utilities", "Mobile Phone", "Gas & Fuel", 
            "Groceries", "Internet", "maid", "Cook", "garbage disposal", 
            "water (jar /tanker)", "Auto Insurance"
        ]
        
        df["Needs_vs_Wants"] = np.where(
            df["Category"].isin(needs_categories), "Kebutuhan", "Keinginan"
        )
        return df
    except:
        return pd.DataFrame()

df = load_and_process_data()
if df.empty: 
    st.error("Gagal memuat data. Periksa file 'data_cleaned.csv'.")
    st.stop()

expense_df = df[df["Transaction Type"] == "Expense"].copy()

# =========================
# SIDEBAR
# =========================
st.sidebar.markdown(f"## 📊 Filter Analisis")
selected_years = st.sidebar.multiselect("📅 Tahun", options=sorted(expense_df["Year"].unique()), default=sorted(expense_df["Year"].unique()))
selected_cats = st.sidebar.multiselect("📚 Kategori", options=sorted(expense_df["Category"].unique()), default=sorted(expense_df["Category"].unique()))

filtered_df = expense_df[(expense_df["Year"].isin(selected_years)) & (expense_df["Category"].isin(selected_cats))]

# =========================
# HEADER
# =========================
st.markdown('<div class="main-title">💵 Track Smart Analysis</div>', unsafe_allow_html=True)
st.markdown('<div class="creator-text">Dibuat oleh: Nabilah Yasmin Qasthalani & Vinda Karunia Surya</div>', unsafe_allow_html=True)

if not filtered_df.empty:
    monthly_totals = filtered_df.groupby(["Year", "Month"])["Amount_IDR"].sum()
    avg_monthly_spent = monthly_totals.mean()
    total_spent = filtered_df["Amount_IDR"].sum()
    top_cat_name = filtered_df.groupby("Category")["Amount_IDR"].sum().idxmax()

    # KPI Row
    m1, m2, m3 = st.columns(3)
    m1.markdown(f'<div class="card"><div class="card-title">Rata-rata / Bulan</div><div class="card-value">Rp {avg_monthly_spent:,.0f}</div></div>', unsafe_allow_html=True)
    m2.markdown(f'<div class="card"><div class="card-title">Total Pengeluaran</div><div class="card-value">Rp {total_spent:,.0f}</div></div>', unsafe_allow_html=True)
    m3.markdown(f'<div class="card"><div class="card-title">Kategori Terbesar</div><div class="card-value">{top_cat_name}</div></div>', unsafe_allow_html=True)

    st.write("###")

    tab1, tab2, tab3, tab4 = st.tabs(["📈 Tren & Kuartal", "📊 Top Kategori", "🥠 Analisis Proporsi", "📋 Tabel Data"])

    def style_chart(fig):
        fig.update_layout(
            font=dict(color=TEXT_DARK), 
            title_font_color=PRIMARY,
            paper_bgcolor='rgba(0,0,0,0)', 
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis=dict(tickfont=dict(color=TEXT_DARK), title_font=dict(color=TEXT_DARK), gridcolor="rgba(0,0,0,0)"),
            yaxis=dict(tickfont=dict(color=TEXT_DARK), title_font=dict(color=TEXT_DARK), gridcolor="rgba(0,0,0,0)")
        )
        return fig

    with tab1:
        col_t1, col_t2 = st.columns(2)
        with col_t1:
            trend_data = filtered_df.groupby("YearMonth")["Amount_IDR"].sum().reset_index()
            fig_trend = px.line(trend_data, x="YearMonth", y="Amount_IDR", title="Tren Pengeluaran Bulanan",
                                markers=True, color_discrete_sequence=[PRIMARY], template="plotly_white")
            st.plotly_chart(style_chart(fig_trend), use_container_width=True)
        with col_t2:
            quarter_data = filtered_df.groupby("Quarter")["Amount_IDR"].sum().reset_index()
            fig_quarter = px.bar(quarter_data, x="Quarter", y="Amount_IDR", title="Total Pengeluaran per Kuartal",
                                 color_discrete_sequence=[PALETTE[1]], template="plotly_white", text_auto='.2s')
            st.plotly_chart(style_chart(fig_quarter), use_container_width=True)
        st.markdown(f"""<div class="interpretation-box"><b>Interpretasi Tren:</b><br>Analisis tren menunjukkan kestabilan pengeluaran bulanan. Rata-rata pengeluaran Anda per bulan adalah <b>Rp {avg_monthly_spent:,.0f}</b>. Lonjakan pada periode tertentu dapat digunakan sebagai acuan evaluasi biaya musiman atau kejadian tak terduga.</div>""", unsafe_allow_html=True)

    with tab2:
        top_cat_df = filtered_df.groupby("Category")["Amount_IDR"].sum().reset_index().sort_values("Amount_IDR").tail(10)
        fig_bar = px.bar(top_cat_df, x="Amount_IDR", y="Category", orientation='h', title="Top 10 Kategori Pengeluaran",
                         color_discrete_sequence=[PRIMARY], text_auto='.2s', template="plotly_white")
        st.plotly_chart(style_chart(fig_bar), use_container_width=True)
        st.markdown(f"""<div class="interpretation-box"><b>Interpretasi Kategori:</b><br>Kategori <b>{top_cat_name}</b> merupakan pos pengeluaran tertinggi. Memantau transaksi pada kategori dominan ini adalah langkah paling efektif untuk melakukan efisiensi anggaran.</div>""", unsafe_allow_html=True)

    with tab3:
        col_l, col_r = st.columns(2)
        with col_l:
            nvw_data = filtered_df.groupby("Needs_vs_Wants")["Amount_IDR"].sum().reset_index()
            fig_nvw = px.pie(nvw_data, values="Amount_IDR", names="Needs_vs_Wants", title="Rasio Kebutuhan vs Keinginan", 
                             hole=0.4, color_discrete_sequence=PALETTE, template="plotly_white")
            fig_nvw.update_layout(title_font_color=PRIMARY, font=dict(color=TEXT_DARK), legend_font_color=TEXT_DARK, paper_bgcolor='rgba(0,0,0,0)')
            fig_nvw.update_traces(textinfo='percent+label', textfont_color=TEXT_DARK)
            st.plotly_chart(fig_nvw, use_container_width=True)
            
            perc_needs = (nvw_data[nvw_data["Needs_vs_Wants"]=="Kebutuhan"]["Amount_IDR"].sum() / total_spent) * 100 if total_spent > 0 else 0
            st.markdown(f"""<div class="interpretation-box"><b>Interpretasi Rasio:</b><br>Alokasi <b>Kebutuhan</b> Anda sebesar <b>{perc_needs:.1f}%</b>. Rasio ini membantu Anda mengukur seberapa besar gaya hidup ("Keinginan") memengaruhi arus kas bulanan.</div>""", unsafe_allow_html=True)

        with col_r:
            split_cats = ["Restaurants", "Fast Food", "Coffee Shops", "Food", "Alcohol & Bars"]
            split_df = filtered_df[filtered_df["Category"].isin(split_cats)]
            if not split_df.empty:
                split_data = split_df["Category"].value_counts().reset_index().head(5)
                split_data.columns = ['Category', 'count']
                fig_split = px.pie(split_data, values="count", names="Category", title="Top 5 Kategori Gaya Hidup", 
                                   hole=0.4, color_discrete_sequence=PALETTE, template="plotly_white")
                fig_split.update_layout(title_font_color=PRIMARY, font=dict(color=TEXT_DARK), legend_font_color=TEXT_DARK, paper_bgcolor='rgba(0,0,0,0)')
                fig_split.update_traces(textinfo='percent+label', textfont_color=TEXT_DARK)
                st.plotly_chart(fig_split, use_container_width=True)
                
                # BAGIAN INTERPRETASI YANG DITAMBAHKAN KEMBALI
                st.markdown(f"""<div class="interpretation-box"><b>Interpretasi Gaya Hidup:</b><br>Berdasarkan frekuensi transaksi, kategori <b>{split_data.iloc[0]['Category']}</b> paling sering muncul. Hal ini menunjukkan area pengeluaran sosial yang cukup aktif dan berpotensi untuk dioptimalkan melalui pengelolaan biaya gaya hidup.</div>""", unsafe_allow_html=True)
            else:
                st.info("Data gaya hidup tidak tersedia.")

    with tab4:
        st.dataframe(filtered_df, use_container_width=True)
else:
    st.info("Sesuaikan filter di sidebar untuk melihat analisis.")
